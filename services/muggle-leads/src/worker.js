import { adminPage } from "./admin-page.js";
import {
  listCampaigns,
  listProjects,
  listSlots,
  publicAdSlots,
  saveCampaign,
  saveProject,
  saveSlot,
  serveAdAsset,
  uploadCampaignImage,
} from "./ad-store.js";

const INTENT_TYPES = {
  ads: "广告位出租",
  development: "项目开发合作",
  token_supply: "AI 中转站 Token 批发供应",
  other: "其他",
};

const STATUSES = new Set(["new", "contacted", "closed"]);
const RATE_WINDOW_SECONDS = 60;
const RATE_MAX = 3;
const UNSAFE_TEXT_PATTERNS = [
  /<\s*\/?\s*[a-z][^>]*>/i,
  /\bon[a-z]+\s*=/i,
  /\bjavascript\s*:/i,
  /\bdata\s*:\s*text\/html/i,
];

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(request, env) });
  }

  const adAssetMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/ad-assets\/(.+)$/);
  if (adAssetMatch && request.method === "GET") {
    return catchResponse(request, env, () => serveAdAsset(request, env, decodeURIComponent(adAssetMatch[1]), adAssetMatch[2]));
  }

  const publicAdSlotsMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/ad-slots$/);
  if (publicAdSlotsMatch && request.method === "GET") {
    if (!env.DB) {
      return json({ version: 1, slots: [] }, 200, request, env, { "cache-control": "public, max-age=60" });
    }
    return catchResponse(request, env, async () => json(
      await publicAdSlots(request, env, decodeURIComponent(publicAdSlotsMatch[1])),
      200,
      request,
      env,
      { "cache-control": "public, max-age=60" }
    ));
  }

  const sourceMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/intents$/);
  if (sourceMatch && request.method === "POST") {
    return submitIntent(request, env, decodeURIComponent(sourceMatch[1]));
  }

  if (url.pathname === "/admin" && request.method === "GET") {
    return html(adminPage());
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return adminLogin(request, env);
  }

  if (url.pathname === "/api/admin/intents" && request.method === "GET") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return listIntents(request, env);
  }

  if (url.pathname === "/api/admin/ad-projects" && request.method === "GET") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return catchResponse(request, env, async () => json({ success: true, items: await listProjects(env) }, 200, request, env));
  }

  if (url.pathname === "/api/admin/ad-projects" && request.method === "POST") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    const body = await request.json().catch(() => ({}));
    return catchResponse(request, env, async () => json({ success: true, item: await saveProject(env, body) }, 200, request, env));
  }

  const adminSlotsMatch = url.pathname.match(/^\/api\/admin\/ad-projects\/([^/]+)\/ad-slots$/);
  if (adminSlotsMatch && request.method === "GET") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return catchResponse(request, env, async () => json({ success: true, items: await listSlots(env, decodeURIComponent(adminSlotsMatch[1])) }, 200, request, env));
  }

  if (adminSlotsMatch && request.method === "POST") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    const body = await request.json().catch(() => ({}));
    return catchResponse(request, env, async () => json({ success: true, item: await saveSlot(env, decodeURIComponent(adminSlotsMatch[1]), body) }, 200, request, env));
  }

  const adminCampaignsMatch = url.pathname.match(/^\/api\/admin\/ad-slots\/([^/]+)\/campaigns$/);
  if (adminCampaignsMatch && request.method === "GET") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return catchResponse(request, env, async () => json({
      success: true,
      items: await listCampaigns(env, decodeURIComponent(adminCampaignsMatch[1]), new Date().toISOString(), request),
    }, 200, request, env));
  }

  if (adminCampaignsMatch && request.method === "POST") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    const body = await request.json().catch(() => ({}));
    return catchResponse(request, env, async () => json({
      success: true,
      item: await saveCampaign(env, decodeURIComponent(adminCampaignsMatch[1]), body, new Date().toISOString(), request),
    }, 200, request, env));
  }

  const adminCampaignMatch = url.pathname.match(/^\/api\/admin\/ad-campaigns\/([^/]+)$/);
  if (adminCampaignMatch && request.method === "PATCH") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    const body = await request.json().catch(() => ({}));
    return catchResponse(request, env, async () => json({
      success: true,
      item: await saveCampaign(env, body.slot_id || "", { ...body, id: decodeURIComponent(adminCampaignMatch[1]) }, new Date().toISOString(), request),
    }, 200, request, env));
  }

  const campaignImageMatch = url.pathname.match(/^\/api\/admin\/ad-campaigns\/([^/]+)\/image$/);
  if (campaignImageMatch && request.method === "POST") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return catchResponse(request, env, async () => json({
      success: true,
      item: await uploadCampaignImage(request, env, decodeURIComponent(campaignImageMatch[1])),
    }, 200, request, env));
  }

  const intentStatusMatch = url.pathname.match(/^\/api\/admin\/intents\/([^/]+)$/);
  if (intentStatusMatch && request.method === "PATCH") {
    const auth = requireAdmin(request, env);
    if (auth) return auth;
    return updateIntentStatus(request, env, decodeURIComponent(intentStatusMatch[1]));
  }

  return json({ success: false, message: "Not found" }, 404, request, env);
}

async function submitIntent(request, env, sourceId) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    return json({ success: false, message: "请求格式无效" }, 400, request, env);
  }

  let intent;
  try {
    intent = normalizeIntent(raw, sourceId);
  } catch (error) {
    return json({ success: false, message: error.message }, 400, request, env);
  }

  const clientKey = await clientFingerprint(request, env, intent.source_id);
  const since = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM intents WHERE client_key = ? AND created_at >= ?"
  ).bind(clientKey, since).first();
  if ((recent?.count || 0) >= RATE_MAX) {
    return json({ success: false, message: "提交太频繁，请稍后再试" }, 429, request, env);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO intents (
      id, created_at, updated_at, source_id, source_name, source_version,
      intent_type, intent_type_label, name, contact, message, status, client_key, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    now,
    now,
    intent.source_id,
    intent.source_name,
    intent.source_version,
    intent.intent_type,
    intent.intent_type_label,
    intent.name,
    intent.contact,
    intent.message,
    "new",
    clientKey,
    request.headers.get("user-agent") || ""
  ).run();

  let notified = false;
  try {
    notified = await notifyTelegram(env, buildTelegramText({ id, created_at: now, ...intent }));
  } catch (error) {
    console.warn("Telegram notification failed", error);
  }

  return json({ success: true, message: "已提交，我会尽快联系你。", id, notified }, 200, request, env);
}

export function normalizeIntent(raw, sourceId) {
  const source_id = clean(sourceId, 80);
  const source_name = clean(raw.source_name || source_id, 120);
  const source_version = clean(raw.source_version || "", 40);
  const intent_type = clean(raw.intent_type, 40);
  const intent_type_label = clean(raw.intent_type_label || INTENT_TYPES[intent_type] || intent_type, 80);
  const name = clean(raw.name, 80);
  const contact = clean(raw.contact, 120);
  const message = clean(raw.message, 1000);

  if (!source_id) throw new Error("来源不能为空");
  if (!INTENT_TYPES[intent_type]) throw new Error("合作类型无效");
  if (!name) throw new Error("称呼不能为空");
  if (!contact) throw new Error("联系方式不能为空");
  if (message.length < 5) throw new Error("合作需求不能少于 5 个字符");
  assertSafeText("称呼", name);
  assertSafeText("联系方式", contact);
  assertSafeText("合作需求", message);

  return {
    source_id,
    source_name,
    source_version,
    intent_type,
    intent_type_label,
    name,
    contact,
    message,
  };
}

export function buildTelegramText(intent) {
  return [
    "新的合作意向",
    `来源: ${intent.source_name} (${intent.source_id})`,
    intent.source_version ? `版本: ${intent.source_version}` : "",
    `类型: ${intent.intent_type_label}`,
    `称呼: ${intent.name}`,
    `联系方式: ${intent.contact}`,
    `时间: ${intent.created_at}`,
    "",
    "合作需求:",
    intent.message,
  ].filter(Boolean).join("\n");
}

async function notifyTelegram(env, text) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TG_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => ({}));
  return data.ok === true;
}

async function listIntents(request, env) {
  const url = new URL(request.url);
  const where = [];
  const params = [];
  const source = clean(url.searchParams.get("source") || "", 80);
  const status = clean(url.searchParams.get("status") || "", 30);
  const q = clean(url.searchParams.get("q") || "", 120);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);

  if (source) {
    where.push("source_id = ?");
    params.push(source);
  }
  if (status && STATUSES.has(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(name LIKE ? OR contact LIKE ? OR message LIKE ? OR source_name LIKE ?)");
    params.push(...Array(4).fill(`%${q}%`));
  }

  const sql = `
    SELECT id, created_at, updated_at, source_id, source_name, source_version,
      intent_type, intent_type_label, name, contact, message, status
    FROM intents
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  params.push(limit);
  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ success: true, items: result.results || [] }, 200, request, env);
}

async function updateIntentStatus(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const status = clean(body.status, 30);
  if (!STATUSES.has(status)) {
    return json({ success: false, message: "状态无效" }, 400, request, env);
  }

  await env.DB.prepare("UPDATE intents SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
  return json({ success: true }, 200, request, env);
}

async function adminLogin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return json({ success: false, message: "ADMIN_TOKEN 未配置" }, 503, request, env);
  }

  const body = await request.json().catch(() => ({}));
  if (body.token !== env.ADMIN_TOKEN) {
    return json({ success: false, message: "登录失败" }, 401, request, env);
  }

  return json({ success: true }, 200, request, env, {
    "set-cookie": `ml_admin=${encodeURIComponent(env.ADMIN_TOKEN)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`,
  });
}

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return json({ success: false, message: "ADMIN_TOKEN 未配置" }, 503, request, env);
  }

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${env.ADMIN_TOKEN}`) {
    return null;
  }

  const cookie = request.headers.get("cookie") || "";
  if (cookie.split(";").some((item) => item.trim() === `ml_admin=${encodeURIComponent(env.ADMIN_TOKEN)}`)) {
    return null;
  }

  return json({ success: false, message: "未登录" }, 401, request, env);
}

async function clientFingerprint(request, env, sourceId) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const salt = env.IP_HASH_SALT || env.ADMIN_TOKEN || "muggle-leads";
  return sha256(`${salt}:${sourceId}:${ip}`);
}

async function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200, request, env, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

async function catchResponse(request, env, fn) {
  try {
    return await fn();
  } catch (error) {
    return json({ success: false, message: error.message || "请求失败" }, error.status || 500, request, env);
  }
}

function html(body) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'self'; img-src 'self' https: data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
    },
  });
}

function corsHeaders(request, env) {
  if (!request) return {};
  const origin = request.headers.get("origin") || "*";
  const configured = (env?.ALLOWED_ORIGINS || "*").split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = configured.includes("*") || configured.includes(origin) ? origin : configured[0] || "*";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

function clean(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function assertSafeText(label, value) {
  if (UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`${label}包含无效内容`);
  }
}
