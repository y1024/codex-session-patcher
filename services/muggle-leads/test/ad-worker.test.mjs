import test from "node:test";
import assert from "node:assert/strict";

import { handleRequest } from "../src/worker.js";

class FakeDB {
  constructor() {
    this.projects = [{
      id: "codex-session-patcher",
      name: "Codex Session Patcher",
      created_at: "2026-06-08T00:00:00.000Z",
      updated_at: "2026-06-08T00:00:00.000Z",
    }];
    this.slots = [{
      id: "slot-1",
      project_id: "codex-session-patcher",
      group_key: "enhance",
      group_label: "增强",
      position_key: "left",
      position_label: "左侧",
      suggested_ratio: "3:4",
      suggested_size: "1080 × 1440",
      default_fit: "natural",
      default_width: "260px",
      default_max_height: "72vh",
      enabled: 1,
      created_at: "2026-06-08T00:00:00.000Z",
      updated_at: "2026-06-08T00:00:00.000Z",
    }];
    this.campaigns = [];
  }

  prepare(sql) {
    return new FakeStmt(this, sql);
  }
}

class FakeStmt {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    if (this.sql.includes("FROM ad_projects")) {
      return { results: this.db.projects };
    }
    if (this.sql.includes("FROM ad_slots") && this.sql.includes("WHERE project_id = ?")) {
      return { results: this.db.slots.filter((slot) => slot.project_id === this.args[0]) };
    }
    if (this.sql.includes("FROM ad_campaigns") && this.sql.includes("WHERE slot_id = ?")) {
      return { results: this.db.campaigns.filter((campaign) => campaign.slot_id === this.args[0]) };
    }
    if (this.sql.includes("JOIN ad_campaigns") || this.sql.includes("JOIN ad_slots")) {
      const [projectId, nowA, nowB] = this.args;
      return {
        results: this.db.campaigns
          .filter((campaign) => campaign.enabled && campaign.start_at <= nowA && campaign.end_at > nowB)
          .map((campaign) => ({
            ...campaign,
            ...this.db.slots.find((slot) => slot.id === campaign.slot_id),
          }))
          .filter((row) => row.project_id === projectId),
      };
    }
    return { results: [] };
  }

  async first() {
    if (this.sql.includes("FROM ad_slots WHERE id = ?")) {
      return this.db.slots.find((slot) => slot.id === this.args[0]) || null;
    }
    if (this.sql.includes("FROM ad_campaigns WHERE id = ?")) {
      return this.db.campaigns.find((campaign) => campaign.id === this.args[0]) || null;
    }
    if (this.sql.includes("FROM ad_campaigns") && this.sql.includes("start_at < ?") && this.sql.includes("end_at > ?")) {
      const [slotId, currentId, endAt, startAt] = this.args;
      return this.db.campaigns.find((campaign) => (
        campaign.slot_id === slotId &&
        campaign.id !== currentId &&
        campaign.enabled &&
        campaign.start_at < endAt &&
        campaign.end_at > startAt
      )) || null;
    }
    return null;
  }

  async run() {
    if (this.sql.includes("INSERT INTO ad_campaigns")) {
      const campaign = {
        id: this.args[0],
        slot_id: this.args[1],
        name: this.args[2],
        image_url: this.args[3],
        image_key: this.args[4],
        click_url: this.args[5],
        alt: this.args[6],
        title: this.args[7],
        fit: this.args[8],
        width: this.args[9],
        max_height: this.args[10],
        start_at: this.args[11],
        end_at: this.args[12],
        enabled: this.args[13],
        activated_at: this.args[14],
        rent_amount: this.args[15],
        currency: this.args[16],
        billing_type: this.args[17],
        rent_note: this.args[18],
        created_at: this.args[19],
        updated_at: this.args[20],
      };
      const index = this.db.campaigns.findIndex((item) => item.id === campaign.id);
      if (index >= 0) this.db.campaigns[index] = { ...this.db.campaigns[index], ...campaign };
      else this.db.campaigns.push(campaign);
    }
    return { success: true };
  }
}

class FakeR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options) {
    this.objects.set(key, { value, options });
  }
}

function authHeaders() {
  return { authorization: "Bearer admin", "content-type": "application/json" };
}

test("admin lists projects and slots", async () => {
  const env = { DB: new FakeDB(), ADMIN_TOKEN: "admin" };
  const projects = await handleRequest(new Request("https://leads.example/api/admin/ad-projects", { headers: authHeaders() }), env);
  assert.equal(projects.status, 200);
  assert.equal((await projects.json()).items.length, 1);

  const slots = await handleRequest(new Request("https://leads.example/api/admin/ad-projects/codex-session-patcher/ad-slots", { headers: authHeaders() }), env);
  assert.equal(slots.status, 200);
  assert.equal((await slots.json()).items[0].group_key, "enhance");
});

test("draft campaign can be saved without image or dates", async () => {
  const db = new FakeDB();
  const response = await handleRequest(new Request("https://leads.example/api/admin/ad-slots/slot-1/campaigns", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: "草稿投放", enabled: false }),
  }), { DB: db, ADMIN_TOKEN: "admin" });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.item.status, "draft");
  assert.equal(db.campaigns.length, 1);
});

test("enabled campaign requires image and valid dates", async () => {
  const response = await handleRequest(new Request("https://leads.example/api/admin/ad-slots/slot-1/campaigns", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: "缺字段", enabled: true }),
  }), { DB: new FakeDB(), ADMIN_TOKEN: "admin" });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.message, /图片/);
});

test("overlapping enabled campaign is rejected", async () => {
  const db = new FakeDB();
  db.campaigns.push({
    id: "existing",
    slot_id: "slot-1",
    name: "已有投放",
    enabled: 1,
    image_url: "https://cdn.example.com/a.png",
    start_at: "2026-06-08T00:00:00.000Z",
    end_at: "2026-06-09T00:00:00.000Z",
  });
  const response = await handleRequest(new Request("https://leads.example/api/admin/ad-slots/slot-1/campaigns", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: "冲突",
      enabled: true,
      image_url: "https://cdn.example.com/b.png",
      start_at: "2026-06-08T12:00:00.000Z",
      end_at: "2026-06-10T00:00:00.000Z",
    }),
  }), { DB: db, ADMIN_TOKEN: "admin" });

  assert.equal(response.status, 409);
});

test("public endpoint only returns currently active campaigns", async () => {
  const db = new FakeDB();
  db.campaigns.push({
    id: "active",
    slot_id: "slot-1",
    name: "进行中",
    enabled: 1,
    image_url: "https://cdn.example.com/ad.png",
    click_url: "https://example.com",
    alt: "广告图",
    title: "查看",
    fit: "contain",
    width: "260px",
    max_height: "72vh",
    start_at: "2020-01-01T00:00:00.000Z",
    end_at: "2999-01-01T00:00:00.000Z",
  });

  const response = await handleRequest(new Request("https://leads.example/api/sources/codex-session-patcher/ad-slots"), { DB: db });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.slots.length, 1);
  assert.equal(data.slots[0].tab, "enhance");
  assert.equal(data.slots[0].position, "left");
  assert.equal(data.slots[0].image_url, "https://cdn.example.com/ad.png");
});

test("admin can upload a campaign image", async () => {
  const db = new FakeDB();
  db.campaigns.push({
    id: "campaign-1",
    slot_id: "slot-1",
    name: "草稿",
    enabled: 0,
    image_url: "",
    image_key: "",
    created_at: "2026-06-08T00:00:00.000Z",
    updated_at: "2026-06-08T00:00:00.000Z",
  });
  const assets = new FakeR2();
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "ad.png");

  const response = await handleRequest(new Request("https://leads.example/api/admin/ad-campaigns/campaign-1/image", {
    method: "POST",
    headers: { authorization: "Bearer admin" },
    body: form,
  }), { DB: db, AD_ASSETS: assets, ADMIN_TOKEN: "admin" });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(assets.objects.size, 1);
  assert.match(data.item.image_url, /^https:\/\/leads\.example\/api\/sources\/codex-session-patcher\/ad-assets\//);
});
