const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 12;
const CLAIM_TOKEN_BYTES = 32;
const MIN_STAGE_DURATION_MS = 25_000;
const MIN_CLIENT_STAGE_SECONDS = 29;
const MAX_REQUEST_BYTES = 8_192;
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class RequestError extends Error {
  constructor(message, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function apiError(message, status = 400, code = "bad_request") {
  return json({ ok: false, code, message }, status);
}

function isTrustedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || origin === "https://heist.yeseo.im";
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) throw new RequestError("요청이 너무 큽니다.", 413, "body_too_large");
  const contentType = request.headers.get("content-type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError("JSON 요청만 허용됩니다.", 415, "unsupported_media_type");
  }
  if (!request.body) throw new RequestError("JSON 본문이 필요합니다.");
  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_REQUEST_BYTES);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestError("요청이 너무 큽니다.", 413, "body_too_large");
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
  } catch {
    throw new RequestError("올바른 JSON 요청이 필요합니다.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("JSON 객체가 필요합니다.");
  }
  return body;
}

async function limitRequest(request, env, creatingSession) {
  // CF-Connecting-IP is supplied by Cloudflare, never accept a body/X-Forwarded-For key.
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const bindings = creatingSession ? [env.API_RATE_LIMITER, env.SESSION_RATE_LIMITER] : [env.API_RATE_LIMITER];
  for (const binding of bindings) {
    if (!binding) throw new RequestError("잠시 후 다시 시도해 주세요.", 503, "rate_limit_unavailable");
    if (!(await binding.limit({ key: `warehouse-heist:${ip}` })).success) {
      const response = apiError("요청이 많습니다. 1분 뒤 다시 시도해 주세요.", 429, "rate_limited");
      response.headers.set("retry-after", "60");
      return response;
    }
  }
  return null;
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashClaimToken(token) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

function randomClaimToken() {
  const bytes = new Uint8Array(CLAIM_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function generateRewardCode() {
  const output = [];
  const rejectionLimit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  while (output.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const value of bytes) {
      if (value >= rejectionLimit) continue;
      output.push(CODE_ALPHABET[value % CODE_ALPHABET.length]);
      if (output.length === CODE_LENGTH) break;
    }
  }
  return `${output.slice(0, 4).join("")}-${output.slice(4, 8).join("")}-${output.slice(8, 12).join("")}`;
}

export function splitRewardCode(code) {
  const parts = String(code).split("-");
  if (parts.length !== 3 || parts.some((part) => part.length !== 4)) throw new Error("Invalid reward code");
  return parts;
}

function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}:${value.second}`,
  };
}

async function createGameSession(env, body) {
  const sessionId = crypto.randomUUID();
  const claimToken = randomClaimToken();
  const claimTokenHash = await hashClaimToken(claimToken);
  const createdAt = new Date().toISOString();
  const clientVersion = typeof body.clientVersion === "string" ? body.clientVersion.slice(0, 32) : "unknown";
  await env.REWARDS_DB.prepare(
    "INSERT INTO game_sessions (id, claim_token_hash, created_at, client_version) VALUES (?, ?, ?, ?)",
  ).bind(sessionId, claimTokenHash, createdAt, clientVersion).run();
  return json({ ok: true, sessionId, claimToken });
}

async function getSession(env, sessionId, claimToken) {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)
    || typeof claimToken !== "string" || !/^[0-9a-f]{64}$/.test(claimToken)) return null;
  const claimTokenHash = await hashClaimToken(claimToken);
  const session = await env.REWARDS_DB.prepare(
    "SELECT id, created_at, last_stage, last_stage_at, completed_at FROM game_sessions WHERE id = ? AND claim_token_hash = ?",
  ).bind(sessionId, claimTokenHash).first();
  if (session && !session.completed_at && Date.parse(session.created_at) <= Date.now() - SESSION_MAX_AGE_MS) {
    throw new RequestError("게임 인증 시간이 만료되었습니다. 새 게임을 시작해 주세요.", 410, "session_expired");
  }
  return session;
}

async function recordStageClear(request, env, sessionId) {
  const body = await readJson(request);
  const session = await getSession(env, sessionId, body.claimToken);
  if (!session) return apiError("게임 세션을 확인할 수 없습니다.", 404, "session_not_found");

  const stage = Number(body.stage);
  if (!Number.isInteger(stage) || stage < 1 || stage > 3) return apiError("스테이지 값이 올바르지 않습니다.");
  if (stage <= Number(session.last_stage)) {
    return json({ ok: true, accepted: true, lastStage: Number(session.last_stage), completed: Number(session.last_stage) === 3 });
  }
  if (stage !== Number(session.last_stage) + 1) return apiError("스테이지를 순서대로 클리어해 주세요.", 409, "stage_order");

  const clientElapsed = Number(body.elapsedSeconds);
  if (!Number.isFinite(clientElapsed) || clientElapsed < MIN_CLIENT_STAGE_SECONDS) {
    return apiError("클리어 시간이 너무 짧아 인증할 수 없습니다.", 409, "stage_time");
  }
  const referenceTime = Date.parse(session.last_stage_at || session.created_at);
  if (!Number.isFinite(referenceTime) || Date.now() - referenceTime < MIN_STAGE_DURATION_MS) {
    return apiError("클리어 시간이 너무 짧아 인증할 수 없습니다.", 409, "stage_time");
  }

  const lives = Number(body.lives);
  if (!Number.isInteger(lives) || lives < 1 || lives > 3) return apiError("남은 생명이 올바르지 않습니다.");
  const clearedAt = new Date().toISOString();
  const completedAt = stage === 3 ? clearedAt : null;
  const statements = [
    env.REWARDS_DB.prepare(
      "UPDATE game_sessions SET last_stage = ?, last_stage_at = ?, completed_at = COALESCE(?, completed_at) WHERE id = ? AND last_stage = ? AND created_at > ?",
    ).bind(stage, clearedAt, completedAt, sessionId, Number(session.last_stage), new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString()),
    env.REWARDS_DB.prepare(
      "INSERT INTO game_stage_clears (session_id, stage, cleared_at, client_elapsed_seconds, lives_remaining) SELECT ?, ?, ?, ?, ? WHERE changes() = 1",
    ).bind(sessionId, stage, clearedAt, clientElapsed, lives),
  ];

  try {
    const [updateResult] = await env.REWARDS_DB.batch(statements);
    if (Number(updateResult.meta?.changes || 0) !== 1) {
      const refreshed = await getSession(env, sessionId, body.claimToken);
      if (refreshed && Number(refreshed.last_stage) >= stage) {
        return json({ ok: true, accepted: true, lastStage: Number(refreshed.last_stage), completed: Number(refreshed.last_stage) === 3 });
      }
      return apiError("스테이지 인증이 충돌했습니다. 다시 시도해 주세요.", 409, "stage_conflict");
    }
  } catch (error) {
    const refreshed = await getSession(env, sessionId, body.claimToken);
    if (refreshed && Number(refreshed.last_stage) >= stage) {
      return json({ ok: true, accepted: true, lastStage: Number(refreshed.last_stage), completed: Number(refreshed.last_stage) === 3 });
    }
    console.error(JSON.stringify({ event: "stage_clear_failed", sessionId, stage, message: error.message }));
    return apiError("스테이지 인증을 저장하지 못했습니다.", 500, "stage_write_failed");
  }

  return json({ ok: true, accepted: true, lastStage: stage, completed: stage === 3 });
}

// Cron is the only Sheets sender: user retries cannot fan out webhook requests.
async function syncRewardToSheet(env, reward) {
  const leaseToken = crypto.randomUUID();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 120_000).toISOString();
  const claim = await env.REWARDS_DB.prepare(
    "UPDATE reward_codes SET sheet_sync_lease_token = ?, sheet_sync_lease_until = ?, sheet_sync_attempts = sheet_sync_attempts + 1 WHERE id = ? AND sheet_sync_status = 'pending' AND sheet_next_attempt_at <= ? AND (sheet_sync_lease_until IS NULL OR sheet_sync_lease_until <= ?)",
  ).bind(leaseToken, leaseUntil, reward.id, now.toISOString(), now.toISOString()).run();
  if (Number(claim.meta?.changes) !== 1) return;

  let synced = false;
  let failure = null;
  try {
    const response = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: env.SHEETS_WEBHOOK_SECRET,
        row: {
          sequence: reward.id,
          createdDate: reward.created_date,
          createdTime: reward.created_time,
          part1: reward.part1,
          part2: reward.part2,
          part3: reward.part3,
          valid: reward.valid === 1 ? "정상" : "비정상",
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) throw new Error("webhook_rejected");
    synced = true;
  } catch {
    // Never persist a third-party response that might echo the shared secret.
    failure = "webhook_failed";
    console.warn(JSON.stringify({ event: "sheet_sync_failed", rewardId: reward.id }));
  }
  const backoffMs = Math.min(3_600_000, 60_000 * 2 ** Math.min(Number(reward.sheet_sync_attempts || 0), 6));
  await env.REWARDS_DB.prepare(
    "UPDATE reward_codes SET sheet_sync_status = ?, sheet_synced_at = CASE WHEN ? = 'synced' THEN ? ELSE sheet_synced_at END, sheet_sync_error = ?, sheet_next_attempt_at = ?, sheet_sync_lease_token = NULL, sheet_sync_lease_until = NULL WHERE id = ? AND sheet_sync_lease_token = ?",
  ).bind(synced ? "synced" : "pending", synced ? "synced" : "pending", new Date().toISOString(), failure,
    new Date(Date.now() + backoffMs).toISOString(), reward.id, leaseToken).run();
}

export async function runMaintenance(env, scheduledTime = Date.now()) {
  if (env.SHEETS_WEBHOOK_URL && env.SHEETS_WEBHOOK_SECRET) {
    const now = new Date().toISOString();
    const { results } = await env.REWARDS_DB.prepare(
      "SELECT id, part1, part2, part3, created_date, created_time, valid, sheet_sync_attempts FROM reward_codes WHERE sheet_sync_status = 'pending' AND sheet_next_attempt_at <= ? AND (sheet_sync_lease_until IS NULL OR sheet_sync_lease_until <= ?) ORDER BY sheet_next_attempt_at, id LIMIT 10",
    ).bind(now, now).all();
    // Sequential delivery respects the receiver's script-wide lock; <=31 D1 queries.
    for (const reward of results) await syncRewardToSheet(env, reward);
  } else {
    console.warn(JSON.stringify({ event: "sheet_sync_not_configured" }));
  }
  if (new Date(scheduledTime).getUTCMinutes() === 0) {
    // Only abandoned, uncompleted sessions; retain all completed/reward-bearing rows.
    const cutoff = new Date(Date.now() - 7 * SESSION_MAX_AGE_MS).toISOString();
    const result = await env.REWARDS_DB.prepare(
      "DELETE FROM game_sessions WHERE id IN (SELECT id FROM game_sessions WHERE completed_at IS NULL AND created_at < ? AND NOT EXISTS (SELECT 1 FROM reward_codes WHERE session_id = game_sessions.id) ORDER BY created_at LIMIT 100)",
    ).bind(cutoff).run();
    console.log(JSON.stringify({ event: "abandoned_sessions_cleaned", count: result.meta?.changes || 0 }));
  }
}

async function findRewardBySession(env, sessionId) {
  return env.REWARDS_DB.prepare(
    "SELECT id, code, part1, part2, part3, created_at, created_date, created_time, valid, sheet_sync_status FROM reward_codes WHERE session_id = ?",
  ).bind(sessionId).first();
}

async function createReward(env, sessionId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRewardCode();
    const [part1, part2, part3] = splitRewardCode(code);
    const createdAt = new Date();
    const local = kstParts(createdAt);
    try {
      const result = await env.REWARDS_DB.prepare(
        "INSERT INTO reward_codes (code, part1, part2, part3, session_id, created_at, created_date, created_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(code, part1, part2, part3, sessionId, createdAt.toISOString(), local.date, local.time).run();
      return {
        id: Number(result.meta.last_row_id),
        code,
        part1,
        part2,
        part3,
        created_at: createdAt.toISOString(),
        created_date: local.date,
        created_time: local.time,
        valid: 1,
        sheet_sync_status: "pending",
      };
    } catch (error) {
      const existing = await findRewardBySession(env, sessionId);
      if (existing) return existing;
      if (!String(error.message).toLowerCase().includes("unique")) throw error;
    }
  }
  throw new Error("Could not generate a unique reward code");
}

async function issueRewardCode(request, env) {
  const body = await readJson(request);
  const session = await getSession(env, body.sessionId, body.claimToken);
  if (!session) return apiError("게임 세션을 확인할 수 없습니다.", 404, "session_not_found");
  if (Number(session.last_stage) !== 3 || !session.completed_at) {
    return apiError("3개 스테이지 클리어 기록이 확인되지 않습니다.", 403, "completion_required");
  }

  let reward = await findRewardBySession(env, session.id);
  let existing = true;
  if (!reward) {
    reward = await createReward(env, session.id);
    existing = false;
  }
  const sheetSynced = reward.sheet_sync_status === "synced";
  return json({
    ok: true,
    code: reward.code,
    parts: [reward.part1, reward.part2, reward.part3],
    createdAt: reward.created_at,
    existing,
    sheetSynced,
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!isTrustedOrigin(request)) return apiError("허용되지 않은 요청 출처입니다.", 403, "origin_denied");
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, sheetSyncConfigured: Boolean(env.SHEETS_WEBHOOK_URL && env.SHEETS_WEBHOOK_SECRET) });
  }
  if (request.method === "POST") {
    const limited = await limitRequest(request, env, url.pathname === "/api/game-sessions");
    if (limited) return limited;
  }
  if (request.method === "POST" && url.pathname === "/api/game-sessions") {
    return createGameSession(env, await readJson(request));
  }
  const stageMatch = url.pathname.match(/^\/api\/game-sessions\/([0-9a-f-]{36})\/stages$/i);
  if (request.method === "POST" && stageMatch) return recordStageClear(request, env, stageMatch[1]);
  if (request.method === "POST" && url.pathname === "/api/reward-codes") return issueRewardCode(request, env);
  return apiError("API 경로를 찾을 수 없습니다.", 404, "not_found");
}

export default {
  async scheduled(controller, env) {
    await runMaintenance(env, controller.scheduledTime);
  },
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof RequestError) return apiError(error.message, error.status, error.code);
      console.error(JSON.stringify({ event: "request_failed", message: error.message, stack: error.stack }));
      return apiError("요청을 처리하지 못했습니다.", 500, "internal_error");
    }
  },
};
