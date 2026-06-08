import {
  DEFAULT_AD_BACKGROUND,
  DEFAULT_AD_MAX_HEIGHT,
  DEFAULT_AD_WIDTH,
  beijingLocalToIso,
  campaignStatus,
  clean,
  normalizeBillingType,
  normalizeBool,
  normalizeFit,
} from "./ad-model.js";

const MAX_AD_IMAGE_BYTES = 5 * 1024 * 1024;
const AD_IMAGE_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function listProjects(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, created_at, updated_at FROM ad_projects ORDER BY name"
  ).all();
  return result.results || [];
}

export async function saveProject(env, raw) {
  const now = new Date().toISOString();
  const id = slug(clean(raw.id || raw.name, 80));
  const name = clean(raw.name, 120);
  if (!id) throw httpError(400, "项目 ID 不能为空");
  if (!name) throw httpError(400, "项目名称不能为空");

  await env.DB.prepare(
    `INSERT INTO ad_projects (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at`
  ).bind(id, name, raw.created_at || now, now).run();

  return { id, name, created_at: raw.created_at || now, updated_at: now };
}

export async function listSlots(env, projectId) {
  const result = await env.DB.prepare(
    `SELECT id, project_id, group_key, group_label, position_key, position_label,
      suggested_ratio, suggested_size, default_fit, default_width, default_max_height,
      enabled, created_at, updated_at
    FROM ad_slots
    WHERE project_id = ?
    ORDER BY group_key, position_key`
  ).bind(projectId).all();
  return (result.results || []).map(adminSlot);
}

export async function saveSlot(env, projectId, raw) {
  const now = new Date().toISOString();
  const groupKey = slug(clean(raw.group_key, 60));
  const positionKey = slug(clean(raw.position_key, 60));
  const id = clean(raw.id, 160) || `${projectId}:${groupKey}:${positionKey}`;
  if (!projectId) throw httpError(400, "项目不能为空");
  if (!groupKey || !positionKey) throw httpError(400, "页面和位置不能为空");

  const slot = {
    id,
    project_id: projectId,
    group_key: groupKey,
    group_label: clean(raw.group_label || groupKey, 80),
    position_key: positionKey,
    position_label: clean(raw.position_label || positionKey, 80),
    suggested_ratio: clean(raw.suggested_ratio || "3:4", 30),
    suggested_size: clean(raw.suggested_size || "1080 × 1440", 80),
    default_fit: normalizeFit(raw.default_fit),
    default_width: normalizeCssLength(raw.default_width) || DEFAULT_AD_WIDTH,
    default_max_height: normalizeCssLength(raw.default_max_height) || DEFAULT_AD_MAX_HEIGHT,
    enabled: raw.enabled === undefined ? true : normalizeBool(raw.enabled),
    created_at: raw.created_at || now,
    updated_at: now,
  };

  await env.DB.prepare(
    `INSERT INTO ad_slots (
      id, project_id, group_key, group_label, position_key, position_label,
      suggested_ratio, suggested_size, default_fit, default_width, default_max_height,
      enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      group_key = excluded.group_key,
      group_label = excluded.group_label,
      position_key = excluded.position_key,
      position_label = excluded.position_label,
      suggested_ratio = excluded.suggested_ratio,
      suggested_size = excluded.suggested_size,
      default_fit = excluded.default_fit,
      default_width = excluded.default_width,
      default_max_height = excluded.default_max_height,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at`
  ).bind(
    slot.id,
    slot.project_id,
    slot.group_key,
    slot.group_label,
    slot.position_key,
    slot.position_label,
    slot.suggested_ratio,
    slot.suggested_size,
    slot.default_fit,
    slot.default_width,
    slot.default_max_height,
    slot.enabled ? 1 : 0,
    slot.created_at,
    slot.updated_at
  ).run();

  return adminSlot(slot);
}

export async function listCampaigns(env, slotId, nowIso = new Date().toISOString(), request) {
  const slot = await getSlot(env, slotId);
  if (!slot) throw httpError(404, "广告位不存在");
  const result = await env.DB.prepare(
    `SELECT id, slot_id, name, image_url, image_key, click_url, alt, title, fit, width,
      max_height, start_at, end_at, enabled, activated_at, rent_amount, currency,
      billing_type, rent_note, created_at, updated_at
    FROM ad_campaigns
    WHERE slot_id = ?
    ORDER BY created_at DESC`
  ).bind(slotId).all();
  return (result.results || []).map((campaign) => adminCampaign(campaign, nowIso, request, slot));
}

export async function saveCampaign(env, slotId, raw, nowIso = new Date().toISOString(), request) {
  const existing = raw.id ? await getCampaign(env, raw.id) : null;
  const resolvedSlotId = slotId || existing?.slot_id || "";
  const slot = await getSlot(env, resolvedSlotId);
  if (!slot) throw httpError(404, "广告位不存在");

  const campaign = normalizeCampaign(slot, raw, existing, nowIso, request);
  if (campaign.enabled) {
    validateEnabledCampaign(campaign);
    const conflict = await findCampaignConflict(env, campaign.slot_id, campaign.id, campaign.start_at, campaign.end_at);
    if (conflict) throw httpError(409, `投放时间和「${conflict.name || conflict.id}」冲突`);
  }

  await upsertCampaign(env, campaign);
  return adminCampaign(campaign, nowIso, request, slot);
}

export async function uploadCampaignImage(request, env, campaignId) {
  if (!env.AD_ASSETS) throw httpError(503, "AD_ASSETS 未绑定，不能上传图片");
  const campaign = await getCampaign(env, campaignId);
  if (!campaign) throw httpError(404, "投放不存在");
  const slot = await getSlot(env, campaign.slot_id);
  if (!slot) throw httpError(404, "广告位不存在");

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!image || typeof image.arrayBuffer !== "function") throw httpError(400, "请选择图片");
  if (!AD_IMAGE_EXTENSIONS[image.type]) throw httpError(400, "图片只支持 PNG、JPG、WebP 或 GIF");
  if (image.size > MAX_AD_IMAGE_BYTES) throw httpError(400, "图片不能超过 5MB");

  const key = `${slot.project_id}/${slot.id}/${campaign.id}-${crypto.randomUUID()}.${AD_IMAGE_EXTENSIONS[image.type]}`;
  await env.AD_ASSETS.put(key, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
  const updated = completeCampaign({ ...campaign, image_key: key, image_url: "", updated_at: new Date().toISOString() }, slot);
  await upsertCampaign(env, updated);
  return adminCampaign(updated, new Date().toISOString(), request, slot);
}

export async function publicAdSlots(request, env, projectId, nowIso = new Date().toISOString()) {
  const result = await env.DB.prepare(
    `SELECT
      s.project_id,
      s.group_key AS tab,
      s.position_key AS position,
      s.default_width,
      s.default_max_height,
      c.id,
      c.slot_id,
      c.image_url,
      c.image_key,
      c.click_url,
      c.alt,
      c.title,
      c.fit,
      c.width,
      c.max_height
    FROM ad_slots s
    JOIN ad_campaigns c ON c.slot_id = s.id
    WHERE s.project_id = ?
      AND s.enabled = 1
      AND c.enabled = 1
      AND c.start_at <= ?
      AND c.end_at > ?
    ORDER BY s.group_key, s.position_key`
  ).bind(projectId, nowIso, nowIso).all();

  return {
    version: 1,
    slots: (result.results || [])
      .filter((row) => row.image_url || row.image_key)
      .map((row) => ({
        tab: row.tab || row.group_key,
        position: row.position || row.position_key,
        enabled: true,
        image_url: adImageUrl(request, row.project_id || projectId, row),
        click_url: row.click_url || "",
        alt: row.alt || "",
        title: row.title || "",
        width: row.width || row.default_width || DEFAULT_AD_WIDTH,
        max_height: row.max_height || row.default_max_height || DEFAULT_AD_MAX_HEIGHT,
        fit: normalizeFit(row.fit),
        background: DEFAULT_AD_BACKGROUND,
      })),
  };
}

export async function serveAdAsset(request, env, sourceId, encodedKey) {
  const source = clean(sourceId, 80);
  const key = decodeURIComponent(encodedKey);
  if (!key.startsWith(`${source}/`)) throw httpError(404, "Not found");
  if (!env.AD_ASSETS) throw httpError(503, "AD_ASSETS 未绑定");

  const object = await env.AD_ASSETS.get(key);
  if (!object) throw httpError(404, "Not found");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(object.body, { headers });
}

async function getSlot(env, slotId) {
  if (!slotId) return null;
  const slot = await env.DB.prepare(
    `SELECT id, project_id, group_key, group_label, position_key, position_label,
      suggested_ratio, suggested_size, default_fit, default_width, default_max_height,
      enabled, created_at, updated_at
    FROM ad_slots WHERE id = ?`
  ).bind(slotId).first();
  return slot ? adminSlot(slot) : null;
}

async function getCampaign(env, campaignId) {
  if (!campaignId) return null;
  const campaign = await env.DB.prepare(
    `SELECT id, slot_id, name, image_url, image_key, click_url, alt, title, fit, width,
      max_height, start_at, end_at, enabled, activated_at, rent_amount, currency,
      billing_type, rent_note, created_at, updated_at
    FROM ad_campaigns WHERE id = ?`
  ).bind(campaignId).first();
  return campaign || null;
}

async function findCampaignConflict(env, slotId, campaignId, startAt, endAt) {
  return env.DB.prepare(
    `SELECT id, name
    FROM ad_campaigns
    WHERE slot_id = ?
      AND id != ?
      AND enabled = 1
      AND start_at < ?
      AND end_at > ?
    LIMIT 1`
  ).bind(slotId, campaignId, endAt, startAt).first();
}

async function upsertCampaign(env, campaign) {
  await env.DB.prepare(
    `INSERT INTO ad_campaigns (
      id, slot_id, name, image_url, image_key, click_url, alt, title, fit, width,
      max_height, start_at, end_at, enabled, activated_at, rent_amount, currency,
      billing_type, rent_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slot_id = excluded.slot_id,
      name = excluded.name,
      image_url = excluded.image_url,
      image_key = excluded.image_key,
      click_url = excluded.click_url,
      alt = excluded.alt,
      title = excluded.title,
      fit = excluded.fit,
      width = excluded.width,
      max_height = excluded.max_height,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      enabled = excluded.enabled,
      activated_at = excluded.activated_at,
      rent_amount = excluded.rent_amount,
      currency = excluded.currency,
      billing_type = excluded.billing_type,
      rent_note = excluded.rent_note,
      updated_at = excluded.updated_at`
  ).bind(
    campaign.id,
    campaign.slot_id,
    campaign.name,
    campaign.image_url,
    campaign.image_key || null,
    campaign.click_url,
    campaign.alt,
    campaign.title,
    campaign.fit,
    campaign.width,
    campaign.max_height,
    campaign.start_at || null,
    campaign.end_at || null,
    campaign.enabled ? 1 : 0,
    campaign.activated_at || null,
    campaign.rent_amount,
    campaign.currency,
    campaign.billing_type,
    campaign.rent_note,
    campaign.created_at,
    campaign.updated_at
  ).run();
}

function normalizeCampaign(slot, raw, existing, nowIso, request) {
  const id = clean(raw.id || existing?.id || crypto.randomUUID(), 120);
  const enabled = normalizeBool(raw.enabled);
  const imageRef = normalizeAdImageRef(request, slot.project_id, raw, existing);
  const campaign = completeCampaign({
    id,
    slot_id: slot.id,
    name: clean(raw.name ?? existing?.name, 120),
    image_url: imageRef.image_url,
    image_key: imageRef.image_key,
    click_url: normalizeClickUrl(raw.click_url ?? existing?.click_url),
    alt: clean(raw.alt ?? existing?.alt, 160),
    title: clean(raw.title ?? existing?.title, 160),
    fit: normalizeFit(raw.fit ?? existing?.fit, slot.default_fit),
    width: normalizeCssLength(raw.width ?? existing?.width) || existing?.width || "",
    max_height: normalizeCssLength(raw.max_height ?? existing?.max_height) || existing?.max_height || "",
    start_at: normalizeIso(raw.start_at ?? existing?.start_at),
    end_at: normalizeIso(raw.end_at ?? existing?.end_at),
    enabled,
    activated_at: enabled ? (existing?.activated_at || nowIso) : (existing?.activated_at || null),
    rent_amount: clean(raw.rent_amount ?? existing?.rent_amount, 40),
    currency: clean(raw.currency ?? existing?.currency ?? "CNY", 12).toUpperCase() || "CNY",
    billing_type: normalizeBillingType(raw.billing_type ?? existing?.billing_type),
    rent_note: clean(raw.rent_note ?? existing?.rent_note, 300),
    created_at: existing?.created_at || nowIso,
    updated_at: nowIso,
  }, slot);

  assertSafePlainText("投放名称", campaign.name);
  assertSafePlainText("图片说明", campaign.alt);
  assertSafePlainText("提示文案", campaign.title);
  assertSafePlainText("租金备注", campaign.rent_note);
  return campaign;
}

function completeCampaign(campaign, slot) {
  return {
    id: campaign.id,
    slot_id: campaign.slot_id,
    name: campaign.name || "",
    image_url: campaign.image_url || "",
    image_key: campaign.image_key || "",
    click_url: campaign.click_url || "",
    alt: campaign.alt || "",
    title: campaign.title || "",
    fit: normalizeFit(campaign.fit, slot.default_fit || "natural"),
    width: campaign.width || "",
    max_height: campaign.max_height || "",
    start_at: campaign.start_at || null,
    end_at: campaign.end_at || null,
    enabled: normalizeBool(campaign.enabled),
    activated_at: campaign.activated_at || null,
    rent_amount: campaign.rent_amount || "",
    currency: campaign.currency || "CNY",
    billing_type: normalizeBillingType(campaign.billing_type),
    rent_note: campaign.rent_note || "",
    created_at: campaign.created_at || new Date().toISOString(),
    updated_at: campaign.updated_at || new Date().toISOString(),
  };
}

function validateEnabledCampaign(campaign) {
  if (!campaign.image_url && !campaign.image_key) throw httpError(400, "启用投放前请先上传图片或填写图片地址");
  if (!campaign.start_at || !campaign.end_at) throw httpError(400, "启用投放前请填写开始时间和结束时间");
  if (campaign.start_at >= campaign.end_at) throw httpError(400, "结束时间必须晚于开始时间");
}

function adminSlot(slot) {
  return {
    ...slot,
    enabled: normalizeBool(slot.enabled),
    default_fit: normalizeFit(slot.default_fit),
    default_width: slot.default_width || DEFAULT_AD_WIDTH,
    default_max_height: slot.default_max_height || DEFAULT_AD_MAX_HEIGHT,
  };
}

function adminCampaign(campaign, nowIso, request, slot) {
  const normalized = completeCampaign(campaign, slot || { default_fit: "natural" });
  return {
    ...normalized,
    enabled: normalizeBool(normalized.enabled),
    image_url: adImageUrl(request, slot?.project_id || "", normalized),
    status: campaignStatus(normalized, nowIso),
  };
}

function adImageUrl(request, projectId, campaign) {
  if (campaign.image_key && request) {
    const origin = new URL(request.url).origin;
    return `${origin}/api/sources/${encodeURIComponent(projectId)}/ad-assets/${encodeURIComponent(campaign.image_key)}`;
  }
  return campaign.image_url || "";
}

function normalizeAdImageRef(request, projectId, raw, existing) {
  const rawImageKey = clean(raw.image_key ?? existing?.image_key, 2000);
  const rawImageUrl = clean(raw.image_url ?? existing?.image_url, 2000);
  if (rawImageKey) return { image_url: "", image_key: rawImageKey };
  if (!rawImageUrl) return { image_url: "", image_key: "" };

  const parsedKey = imageKeyFromUrl(request, projectId, rawImageUrl);
  if (parsedKey) return { image_url: "", image_key: parsedKey };
  if (/^https?:\/\//i.test(rawImageUrl)) return { image_url: rawImageUrl, image_key: "" };
  throw httpError(400, "图片地址只支持 http(s) 或后台上传生成的地址");
}

function imageKeyFromUrl(request, projectId, value) {
  if (!request) return "";
  try {
    const url = new URL(value, new URL(request.url).origin);
    const match = url.pathname.match(/^\/api\/sources\/([^/]+)\/ad-assets\/(.+)$/);
    if (!match || decodeURIComponent(match[1]) !== projectId) return "";
    const key = decodeURIComponent(match[2]);
    return key.startsWith(`${projectId}/`) ? key : "";
  } catch {
    return "";
  }
}

function normalizeClickUrl(value) {
  const text = clean(value, 2000);
  if (!text) return "";
  if (/^(https?:\/\/|mqqapi:\/\/|\/)/i.test(text)) return text;
  throw httpError(400, "点击链接只支持 http(s)、mqqapi 或相对路径");
}

function normalizeIso(value) {
  const text = clean(value, 40);
  if (!text) return "";
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)
    ? new Date(beijingLocalToIso(text))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeCssLength(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(80, Math.min(value, 900))}px`;
  }
  if (typeof value !== "string") return "";
  const text = value.trim();
  const lengthPattern = /^-?\d+(\.\d+)?(px|rem|em|vw|vh|%)$/;
  const clampPattern = /^clamp\(\s*-?\d+(\.\d+)?(px|rem|em|vw|vh|%)\s*,\s*-?\d+(\.\d+)?(px|rem|em|vw|vh|%)\s*,\s*-?\d+(\.\d+)?(px|rem|em|vw|vh|%)\s*\)$/;
  return lengthPattern.test(text) || clampPattern.test(text) ? text : "";
}

function assertSafePlainText(label, value) {
  if (/<\s*\/?\s*[a-z][^>]*>/i.test(value) || /\bon[a-z]+\s*=/i.test(value) || /\bjavascript\s*:/i.test(value)) {
    throw httpError(400, `${label}包含无效内容`);
  }
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
