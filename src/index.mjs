const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 12;
const CLAIM_TOKEN_BYTES = 32;
const MIN_STAGE_DURATION_MS = 25_000;
const MIN_CLIENT_STAGE_SECONDS = 29;
const MAX_REQUEST_BYTES = 8_192;

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
  if (contentLength > MAX_REQUEST_BYTES) throw new Error("요청이 너무 큽니다.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("JSON 요청만 허용됩니다.");
  return request.json();
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
  if (typeof sessionId !== "string" || typeof claimToken !== "string") return null;
  const claimTokenHash = await hashClaimToken(claimToken);
  return env.REWARDS_DB.prepare(
    "SELECT id, created_at, last_stage, last_stage_at, completed_at FROM game_sessions WHERE id = ? AND claim_token_hash = ?",
  ).bind(sessionId, claimTokenHash).first();
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

  const lives = Math.max(0, Math.min(3, Number(body.lives) || 0));
  const clearedAt = new Date().toISOString();
  const completedAt = stage === 3 ? clearedAt : null;
  const statements = [
    env.REWARDS_DB.prepare(
      "UPDATE game_sessions SET last_stage = ?, last_stage_at = ?, completed_at = COALESCE(?, completed_at) WHERE id = ? AND last_stage = ?",
    ).bind(stage, clearedAt, completedAt, sessionId, Number(session.last_stage)),
    env.REWARDS_DB.prepare(
      "INSERT INTO game_stage_clears (session_id, stage, cleared_at, client_elapsed_seconds, lives_remaining) VALUES (?, ?, ?, ?, ?)",
    ).bind(sessionId, stage, clearedAt, clientElapsed, lives),
  ];

  try {
    const [updateResult] = await env.REWARDS_DB.batch(statements);
    if (Number(updateResult.meta?.changes || 0) !== 1) return apiError("스테이지 인증이 충돌했습니다. 다시 시도해 주세요.", 409, "stage_conflict");
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

async function updateSheetSyncState(env, id, status, errorMessage = null) {
  await env.REWARDS_DB.prepare(
    "UPDATE reward_codes SET sheet_sync_status = ?, sheet_sync_attempts = sheet_sync_attempts + 1, sheet_synced_at = CASE WHEN ? = 'synced' THEN ? ELSE sheet_synced_at END, sheet_sync_error = ? WHERE id = ?",
  ).bind(status, status, new Date().toISOString(), errorMessage?.slice(0, 500) || null, id).run();
}

async function syncRewardToSheet(env, reward) {
  if (!env.SHEETS_WEBHOOK_URL || !env.SHEETS_WEBHOOK_SECRET) {
    await updateSheetSyncState(env, reward.id, "pending", "Google Sheets webhook is not configured");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
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
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) throw new Error(result?.message || `Sheets webhook returned ${response.status}`);
    await updateSheetSyncState(env, reward.id, "synced");
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: "sheet_sync_failed", rewardId: reward.id, message: error.message }));
    await updateSheetSyncState(env, reward.id, "pending", error.message);
    return false;
  } finally {
    clearTimeout(timeout);
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
  const sheetSynced = reward.sheet_sync_status === "synced" || await syncRewardToSheet(env, reward);
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
  if (request.method === "POST" && url.pathname === "/api/game-sessions") {
    return createGameSession(env, await readJson(request));
  }
  const stageMatch = url.pathname.match(/^\/api\/game-sessions\/([0-9a-f-]{36})\/stages$/i);
  if (request.method === "POST" && stageMatch) return recordStageClear(request, env, stageMatch[1]);
  if (request.method === "POST" && url.pathname === "/api/reward-codes") return issueRewardCode(request, env);
  return apiError("API 경로를 찾을 수 없습니다.", 404, "not_found");
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ event: "request_failed", message: error.message, stack: error.stack }));
      return apiError("요청을 처리하지 못했습니다.", 500, "internal_error");
    }
  },
};
