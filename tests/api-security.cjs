const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');

(async () => {
  const { default: worker, runMaintenance } = await import('../src/index.mjs');
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}',
    compatibilityDate: '2026-09-16', d1Databases: { REWARDS_DB: 'test-rewards' } }));
  const realFetch = global.fetch;
  try {
    const db = await mf.getD1Database('REWARDS_DB');
    for (const file of fs.readdirSync('migrations').sort()) {
      const sql = fs.readFileSync(`migrations/${file}`, 'utf8').replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').filter(s => s.trim())) await db.prepare(statement).run();
    }
    const allow = { limit: async () => ({ success: true }) };
    const env = { REWARDS_DB: db, API_RATE_LIMITER: allow, SESSION_RATE_LIMITER: allow };
    const request = (path, body, headers = {}) => new Request(`https://heist.yeseo.im${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const call = async (path, body, customEnv = env) => {
      const response = await worker.fetch(request(path, body), customEnv);
      return { status: response.status, body: await response.json() };
    };
    const count = async table => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;

    let cancelled = false;
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(8192)); c.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
    const oversized = new Request('https://heist.yeseo.im/api/game-sessions', { method: 'POST', body: stream, duplex: 'half', headers: { 'content-type': 'application/json' } });
    assert.equal((await worker.fetch(oversized, env)).status, 413);
    assert(cancelled);
    assert.equal(await count('game_sessions'), 0);
    assert.equal((await call('/api/game-sessions', '{"x":"' + '가'.repeat(3000) + '"}')).status, 413);
    for (const body of ['null', '[]', 'true', '{broken']) assert.equal((await call('/api/game-sessions', body)).status, 400);
    assert.equal((await worker.fetch(request('/api/game-sessions', {}, { 'content-type': 'text/plain;application/json' }), env)).status, 415);
    const exact = '{"x":"' + 'a'.repeat(8184) + '"}';
    assert.equal(Buffer.byteLength(exact), 8192);
    assert.equal((await call('/api/game-sessions', exact)).status, 200);
    assert.equal((await call('/api/game-sessions', exact + ' ')).status, 413);
    const before = await count('game_sessions');
    const denied = await worker.fetch(request('/api/game-sessions', {}), { ...env, SESSION_RATE_LIMITER: { limit: async () => ({ success: false }) } });
    assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '60');
    assert.equal(await count('game_sessions'), before);
    assert.equal((await call('/api/game-sessions', {}, { ...env, SESSION_RATE_LIMITER: undefined })).status, 503);
    assert.equal((await worker.fetch(request('/api/game-sessions', {}, { origin: 'https://evil.example' }), env)).status, 403);

    const session = (await call('/api/game-sessions', { clientVersion: 'test' })).body;
    const stagePath = `/api/game-sessions/${session.sessionId}/stages`;
    const progress = stage => ({ claimToken: session.claimToken, stage, elapsedSeconds: 30, lives: 3 });
    const rewardPayload = { sessionId: session.sessionId, claimToken: session.claimToken };
    assert.equal((await call('/api/reward-codes', { ...rewardPayload, claimToken: 'a'.repeat(65) })).status, 404);
    assert.equal((await call('/api/reward-codes', { ...rewardPayload, claimToken: '0'.repeat(64) })).status, 404);
    assert.equal((await call('/api/reward-codes', rewardPayload)).status, 403);
    assert.equal((await call(stagePath, progress(1))).status, 409);
    const past = new Date(Date.now() - 60_000).toISOString();
    await db.prepare('UPDATE game_sessions SET created_at = ? WHERE id = ?').bind(past, session.sessionId).run();
    assert.equal((await call(stagePath, progress(2))).status, 409);
    assert.equal((await call(stagePath, { ...progress(1), lives: 0 })).status, 400);
    const parallel = await Promise.all([call(stagePath, progress(1)), call(stagePath, progress(1))]);
    assert(parallel.every(r => r.status === 200));
    assert.equal(await count('game_stage_clears'), 1);
    for (const stage of [2, 3]) {
      await db.prepare('UPDATE game_sessions SET last_stage_at = ? WHERE id = ?').bind(past, session.sessionId).run();
      assert.equal((await call(stagePath, progress(stage))).status, 200);
    }
    const rewards = await Promise.all([call('/api/reward-codes', rewardPayload), call('/api/reward-codes', rewardPayload)]);
    assert(rewards.every(r => r.status === 200 && r.body.sheetSynced === false));
    assert.equal(rewards[0].body.code, rewards[1].body.code);
    assert.equal(await count('reward_codes'), 1);

    const ancient = new Date(Date.now() - 8 * 86400_000).toISOString();
    await db.prepare('UPDATE game_sessions SET created_at = ? WHERE id = ?').bind(ancient, session.sessionId).run();
    assert.equal((await call('/api/reward-codes', rewardPayload)).body.code, rewards[0].body.code);
    const expired = (await call('/api/game-sessions', {})).body;
    await db.prepare('UPDATE game_sessions SET created_at = ? WHERE id = ?').bind(ancient, expired.sessionId).run();
    assert.equal((await call(`/api/game-sessions/${expired.sessionId}/stages`, { ...progress(1), claimToken: expired.claimToken })).status, 410);

    const syncEnv = { ...env, SHEETS_WEBHOOK_URL: 'https://example.invalid/webhook', SHEETS_WEBHOOK_SECRET: 'test-secret' };
    let deliveries = 0;
    global.fetch = async () => { deliveries++; return new Response(JSON.stringify({ ok: false, message: 'test-secret should never be stored' })); };
    await runMaintenance(syncEnv, Date.UTC(2026, 8, 17, 1, 1));
    let row = await db.prepare('SELECT * FROM reward_codes').first();
    assert.equal(row.sheet_sync_status, 'pending'); assert.equal(row.sheet_sync_attempts, 1);
    assert.equal(row.sheet_sync_error, 'webhook_failed'); assert.equal(row.sheet_sync_lease_token, null);
    assert(Date.parse(row.sheet_next_attempt_at) > Date.now());
    await runMaintenance(syncEnv, Date.UTC(2026, 8, 17, 1, 1));
    assert.equal(deliveries, 1, 'backoff prevents repeated webhook calls');
    await db.prepare("UPDATE reward_codes SET sheet_next_attempt_at = '1970-01-01T00:00:00.000Z'").run();
    global.fetch = async () => { deliveries++; await new Promise(r => setTimeout(r, 25)); return new Response('{"ok":true}'); };
    await Promise.all([runMaintenance(syncEnv), runMaintenance(syncEnv)]);
    assert.equal(deliveries, 2, 'overlapping cron invocations lease one delivery');
    row = await db.prepare('SELECT * FROM reward_codes').first();
    assert.equal(row.sheet_sync_status, 'synced'); assert.equal(row.sheet_sync_attempts, 2);
    assert.equal((await call('/api/reward-codes', rewardPayload)).body.sheetSynced, true);
    await runMaintenance(env, Date.UTC(2026, 8, 17, 1, 0));
    assert.equal(await db.prepare('SELECT id FROM game_sessions WHERE id = ?').bind(expired.sessionId).first(), null);
    assert(await db.prepare('SELECT id FROM game_sessions WHERE id = ?').bind(session.sessionId).first());
    console.log('PASS: byte limits, JSON shape, origin, throttling, token ownership, stage order/timing/races, expiry, reward idempotency, durable retry/backoff/leases, safe cleanup');
  } finally { global.fetch = realFetch; await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
