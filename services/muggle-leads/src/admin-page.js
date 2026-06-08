export function adminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>麻瓜合作台</title>
  <style>
    :root{--bg:#10100e;--panel:#181713;--panel-2:#211f19;--field:#242219;--line:#373225;--line-strong:#665b42;--text:#f7f0df;--muted:#a79b83;--ok:#7cc58b;--bad:#df7d6f;--warn:#d8b35f;--accent:#f1c86b;--radius:14px}
    *{box-sizing:border-box}
    body{margin:0;background:radial-gradient(circle at 10% 0%,#30291a 0,#10100e 36%),linear-gradient(135deg,#10100e,#18150f);color:var(--text);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1220px;margin:0 auto;padding:28px}
    h1{font-size:25px;margin:0 0 18px;letter-spacing:.02em}
    h2,h3{margin:0}
    input,select,button,textarea{font:inherit}
    input,select,textarea{width:100%;background:var(--field);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px 10px}
    textarea{min-height:72px;resize:vertical}
    button,.action-link{border:1px solid var(--line-strong);border-radius:10px;background:#2b271d;color:var(--text);padding:9px 13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    button:hover,.action-link:hover{border-color:var(--accent)}
    button:active,.action-link:active{transform:translateY(1px);filter:brightness(.92)}
    button:focus-visible,.action-link:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    button:disabled,button[data-state=busy],.action-link[data-state=busy]{opacity:.55;cursor:not-allowed}
    .primary{background:var(--accent);color:#17130b;border-color:var(--accent);font-weight:700}
    .ghost{background:transparent}
    .hidden{display:none!important}
    .login,.nav,.toolbar,.layout,.slot-list,.actions,.campaign-meta,.inline{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .login{margin-bottom:18px}
    .nav{margin:0 0 18px;border-bottom:1px solid var(--line);padding-bottom:10px}
    .nav a{background:transparent;border-color:transparent;color:var(--muted)}
    .nav a.active{background:var(--panel);border-color:var(--line);color:var(--text)}
    .toolbar{margin:0 0 14px}
    .toolbar select{max-width:310px}
    .layout{align-items:flex-start}
    .left{width:340px;display:grid;gap:12px}
    .right{flex:1;min-width:320px;display:grid;gap:12px}
    .panel{background:rgba(24,23,19,.94);border:1px solid var(--line);border-radius:var(--radius);padding:14px;box-shadow:0 18px 60px rgba(0,0,0,.22)}
    .tabs{display:flex;gap:8px;flex-wrap:wrap}
    .tabs a{background:transparent;border-color:var(--line);color:var(--muted)}
    .tabs a.active{background:var(--accent);border-color:var(--accent);color:#17130b}
    .slot-button{width:100%;display:grid;gap:4px;text-align:left;margin:8px 0;background:var(--panel-2)}
    .slot-button.active{border-color:var(--accent)}
    .slot-button small,.muted{color:var(--muted)}
    .campaign-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
    .campaign-row:last-child{border-bottom:0}
    .badge{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:2px 8px;color:var(--muted);font-size:12px}
    .badge.running{border-color:rgba(124,197,139,.45);color:var(--ok)}
    .badge.scheduled{border-color:rgba(216,179,95,.45);color:var(--warn)}
    .badge.expired,.badge.disabled{border-color:rgba(223,125,111,.45);color:var(--bad)}
    .dropzone{min-height:260px;border:1px dashed var(--line-strong);border-radius:12px;display:grid;place-items:center;text-align:center;color:var(--muted);overflow:hidden;background:linear-gradient(145deg,#17150f,#211f18)}
    .dropzone.drag{border-color:var(--accent);color:var(--text);background:#282315}
    .dropzone img{width:100%;height:100%;max-height:360px;object-fit:contain;display:block}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    label{display:grid;gap:6px;color:var(--muted);font-size:12px}
    .full{grid-column:1/-1}
    .status{min-height:20px;color:var(--muted)}
    .status.ok{color:var(--ok)}.status.bad{color:var(--bad)}.status.warn{color:var(--warn)}
    table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
    th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:10px}
    th{color:var(--muted);font-weight:500;background:#15130f}
    .msg{white-space:pre-wrap;max-width:360px}
    @media (max-width:860px){main{padding:18px}.left{width:100%}.layout{display:block}.right{margin-top:12px}.form-grid{grid-template-columns:1fr}.toolbar select{max-width:none}}
  </style>
</head>
<body>
  <main>
    <h1>麻瓜合作台</h1>
    <section id="login" class="login">
      <input id="token" type="password" placeholder="管理 Token" />
      <button id="loginBtn" data-state="idle">登录</button>
      <span id="loginMsg" class="status bad"></span>
    </section>
    <section id="app" class="hidden">
      <nav class="nav">
        <a class="action-link active" href="#" data-view="ads" aria-current="page">广告位</a>
        <a class="action-link" href="#" data-view="intents">合作意向</a>
      </nav>
      <section id="adsView">
        <div class="toolbar">
          <select id="projectSelect"></select>
          <button id="newCampaignBtn" class="primary" data-state="idle">新建投放</button>
          <span id="globalMsg" class="status"></span>
        </div>
        <div class="layout">
          <aside class="left">
            <div id="tabs" class="tabs panel"></div>
            <div id="slots" class="panel"></div>
          </aside>
          <section class="right">
            <div id="slotDetail" class="panel"></div>
            <div id="campaigns" class="panel"></div>
            <form id="campaignForm" class="panel hidden"></form>
          </section>
        </div>
      </section>
      <section id="intentsView" class="hidden">
        <div id="intentFilters" class="toolbar">
          <input id="source" placeholder="来源" />
          <select id="status"><option value="">全部状态</option><option value="new">未处理</option><option value="contacted">已联系</option><option value="closed">已关闭</option></select>
          <input id="q" placeholder="关键词搜索" />
        </div>
        <table>
          <thead><tr><th>时间</th><th>来源</th><th>合作项</th><th>联系人</th><th>需求</th><th>状态</th></tr></thead>
          <tbody id="intentRows"></tbody>
        </table>
      </section>
    </section>
  </main>
  <script>
    const state = { projects: [], projectId: "", slots: [], groupKey: "", slot: null, campaigns: [], editing: null };
    const statusLabels = { draft: "草稿", disabled: "已停用", scheduled: "已排期", running: "投放中", expired: "已过期" };
    const billingLabels = [["one_time","一次性"],["yearly","每年"],["monthly","每月"],["weekly","每周"],["daily","每天"]];
    const fitLabels = [["natural","原图比例"],["contain","完整显示"],["cover","铺满裁切"],["fill","强制拉伸"]];
    const $ = selector => document.querySelector(selector);
    const esc = value => String(value || "").replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));

    $("#loginBtn").onclick = loginAdmin;
    $("#projectSelect").onchange = () => {
      const value = $("#projectSelect").value;
      if (value === "__new_project__") {
        $("#projectSelect").value = state.projectId;
        createProject();
        return;
      }
      if (value === "__new_slot__") {
        $("#projectSelect").value = state.projectId;
        createSlot();
        return;
      }
      state.projectId = value;
      loadSlots();
    };
    $("#newCampaignBtn").onclick = () => renderCampaignForm(null);
    document.querySelectorAll(".nav [data-view]").forEach(link => link.onclick = event => { event.preventDefault(); setView(link.dataset.view); });
    ["source","status","q"].forEach(id => $("#" + id).addEventListener("input", debounce(loadIntents, 250)));

    async function loginAdmin() {
      $("#loginBtn").dataset.state = "busy";
      $("#loginMsg").textContent = "";
      try {
        const token = $("#token").value;
        const res = await fetch("/api/admin/login", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ token }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || "登录失败");
        $("#login").classList.add("hidden");
        $("#app").classList.remove("hidden");
        await loadProjects();
      } catch (error) {
        $("#loginMsg").textContent = error.message || "登录失败";
      } finally {
        $("#loginBtn").dataset.state = "idle";
      }
    }

    async function api(path, options = {}) {
      const init = { ...options };
      if (init.body && !(init.body instanceof FormData)) {
        init.headers = { "content-type":"application/json", ...(init.headers || {}) };
        init.body = JSON.stringify(init.body);
      }
      const res = await fetch(path, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "请求失败");
      return data;
    }

    async function loadProjects() {
      setGlobal("加载项目中", "warn");
      try {
        const data = await api("/api/admin/ad-projects");
        state.projects = data.items || [];
        $("#projectSelect").innerHTML = state.projects.map(project => "<option value='" + esc(project.id) + "'>" + esc(project.name) + "</option>").join("") + "<option value='__new_project__'>新增项目...</option><option value='__new_slot__'>新增广告位...</option>";
        state.projectId = state.projectId || state.projects[0]?.id || "";
        $("#projectSelect").value = state.projectId;
        if (!state.projectId) {
          setGlobal("还没有项目，先新增项目", "warn");
          return;
        }
        await loadSlots();
      } catch (error) {
        setGlobal(error.message || "项目加载失败", "bad");
      }
    }

    async function loadSlots() {
      if (!state.projectId) return;
      setGlobal("加载广告位中", "warn");
      const data = await api("/api/admin/ad-projects/" + encodeURIComponent(state.projectId) + "/ad-slots");
      state.slots = data.items || [];
      state.groupKey = state.groupKey || state.slots[0]?.group_key || "";
      renderTabs();
      renderSlots();
      selectSlot(state.slots.find(slot => slot.id === state.slot?.id) || state.slots.find(slot => slot.group_key === state.groupKey) || null);
      setGlobal("共 " + state.slots.length + " 个广告位", "ok");
    }

    function renderTabs() {
      const groups = [...new Map(state.slots.map(slot => [slot.group_key, slot.group_label])).entries()];
      $("#tabs").innerHTML = groups.length ? groups.map(([key, label]) => "<a href='#' class='action-link " + (key === state.groupKey ? "active" : "") + "' data-group='" + esc(key) + "'>" + esc(label) + "</a>").join("") : "<span class='muted'>当前项目还没有广告位</span>";
      $("#tabs").querySelectorAll("[data-group]").forEach(link => link.onclick = event => {
        event.preventDefault();
        state.groupKey = link.dataset.group;
        state.slot = null;
        renderTabs();
        renderSlots();
        selectSlot(state.slots.find(slot => slot.group_key === state.groupKey) || null);
      });
    }

    function renderSlots() {
      const slots = state.slots.filter(slot => slot.group_key === state.groupKey);
      $("#slots").innerHTML = slots.length ? slots.map(slot => "<a href='#' class='action-link slot-button " + (state.slot?.id === slot.id ? "active" : "") + "' data-slot='" + esc(slot.id) + "'><strong>" + esc(slot.position_label) + "</strong></a>").join("") : "<span class='muted'>这个页面还没有广告位</span>";
      $("#slots").querySelectorAll("[data-slot]").forEach(link => link.onclick = event => { event.preventDefault(); selectSlot(state.slots.find(slot => slot.id === link.dataset.slot)); });
    }

    async function selectSlot(slot) {
      state.slot = slot;
      renderSlots();
      $("#campaignForm").classList.add("hidden");
      if (!slot) {
        $("#slotDetail").innerHTML = "<h3>广告位</h3><p class='muted'>先选择或新增广告位。</p>";
        $("#campaigns").innerHTML = "";
        return;
      }
      $("#slotDetail").innerHTML = "<h3>" + esc(slot.group_label) + " · " + esc(slot.position_label) + "</h3><p class='muted'>建议比例 " + esc(slot.suggested_ratio || "-") + "，建议尺寸 " + esc(slot.suggested_size || "-") + "。默认宽度 " + esc(slot.default_width) + "，最高 " + esc(slot.default_max_height) + "。</p>";
      await loadCampaigns();
    }

    async function loadCampaigns() {
      if (!state.slot) return;
      const data = await api("/api/admin/ad-slots/" + encodeURIComponent(state.slot.id) + "/campaigns");
      state.campaigns = data.items || [];
      $("#campaigns").innerHTML = "<h3>投放</h3>" + (state.campaigns.length ? state.campaigns.map(campaign => "<div class='campaign-row'><div><strong>" + esc(campaign.name || "未命名投放") + "</strong><div class='campaign-meta'><span class='badge " + esc(campaign.status) + "'>" + (statusLabels[campaign.status] || campaign.status) + "</span><span class='muted'>" + esc(showTime(campaign.start_at)) + " - " + esc(showTime(campaign.end_at)) + "</span><span class='muted'>" + esc(campaign.rent_amount || "") + " " + esc(campaign.currency || "") + "</span></div></div><a class='action-link' href='#' data-edit='" + esc(campaign.id) + "'>编辑</a></div>").join("") : "<p class='muted'>还没有投放。</p>");
      $("#campaigns").querySelectorAll("[data-edit]").forEach(link => link.onclick = event => { event.preventDefault(); renderCampaignForm(state.campaigns.find(campaign => campaign.id === link.dataset.edit)); });
    }

    function renderCampaignForm(campaign) {
      state.editing = campaign || null;
      const slot = state.slot;
      const form = $("#campaignForm");
      form.classList.remove("hidden");
      form.innerHTML = "<h3>" + (campaign ? "编辑投放" : "新建投放") + "</h3>" +
        "<input type='hidden' name='id' value='" + esc(campaign?.id || "") + "'>" +
        "<input type='hidden' name='image_key' value='" + esc(campaign?.image_key || "") + "'>" +
        "<div class='dropzone' id='dropzone'>" + (campaign?.image_url ? "<img alt='广告图预览' src='" + esc(campaign.image_url) + "'>" : "<div><strong>点击或拖拽上传图片</strong><br><span>建议 " + esc(slot.suggested_ratio || "-") + "，偏差超过 8% 会提醒</span></div>") + "</div>" +
        "<input class='hidden' id='imageInput' type='file' accept='image/png,image/jpeg,image/webp,image/gif'>" +
        "<div id='ratioMsg' class='status'></div>" +
        "<div class='form-grid'>" +
        field("name","投放名称",campaign?.name || "") +
        "<label>状态<select name='enabled'><option value='0' " + (!campaign?.enabled ? "selected" : "") + ">保存草稿</option><option value='1' " + (campaign?.enabled ? "selected" : "") + ">启用投放</option></select></label>" +
        field("image_url","外部图片地址",campaign?.image_url || "", "https://...") +
        field("click_url","点击链接",campaign?.click_url || "", "https://... 或 mqqapi://...") +
        field("start_at","开始时间",isoToBeijingLocal(campaign?.start_at), "", "datetime-local") +
        field("end_at","结束时间",isoToBeijingLocal(campaign?.end_at), "", "datetime-local") +
        "<label>显示方式<select name='fit'>" + optionList(fitLabels, campaign?.fit || slot.default_fit || "natural") + "</select></label>" +
        field("width","宽度",campaign?.width || slot.default_width || "") +
        field("max_height","最高",campaign?.max_height || slot.default_max_height || "") +
        field("rent_amount","租金",campaign?.rent_amount || "", "例如 299") +
        field("currency","币种",campaign?.currency || "CNY") +
        "<label>计费方式<select name='billing_type'>" + optionList(billingLabels, campaign?.billing_type || "one_time") + "</select></label>" +
        field("title","提示文案",campaign?.title || "") +
        field("alt","图片说明",campaign?.alt || "") +
        "<label class='full'>租金备注<textarea name='rent_note'>" + esc(campaign?.rent_note || "") + "</textarea></label>" +
        "</div><div class='actions'><input class='primary action-link' type='submit' value='保存'><a href='#' class='action-link' id='cancelEdit'>取消</a><span id='formMsg' class='status'></span></div>";
      form.onsubmit = event => { event.preventDefault(); saveCampaign(); };
      $("#cancelEdit").onclick = event => { event.preventDefault(); form.classList.add("hidden"); };
      bindDropzone();
      form.scrollIntoView({ behavior:"smooth", block:"start" });
    }

    function bindDropzone() {
      const dropzone = $("#dropzone");
      const input = $("#imageInput");
      dropzone.onclick = () => input.click();
      input.onchange = () => input.files?.[0] && uploadCampaignImage(input.files[0]);
      dropzone.ondragover = event => { event.preventDefault(); dropzone.classList.add("drag"); };
      dropzone.ondragleave = () => dropzone.classList.remove("drag");
      dropzone.ondrop = event => {
        event.preventDefault();
        dropzone.classList.remove("drag");
        const file = event.dataTransfer.files?.[0];
        if (file) uploadCampaignImage(file);
      };
    }

    async function saveCampaign(options = {}) {
      if (!state.slot) return null;
      const form = $("#campaignForm");
      const button = form.querySelector("input[type=submit]");
      const msg = $("#formMsg");
      if (button) button.dataset.state = "busy";
      setNode(msg, "保存中", "warn");
      try {
        const body = campaignBody();
        if (options.forceDraft) body.enabled = false;
        const id = form.elements.id.value;
        const method = id ? "PATCH" : "POST";
        const path = id ? "/api/admin/ad-campaigns/" + encodeURIComponent(id) : "/api/admin/ad-slots/" + encodeURIComponent(state.slot.id) + "/campaigns";
        const data = await api(path, { method, body: { ...body, id, slot_id: state.slot.id } });
        state.editing = data.item;
        form.elements.id.value = data.item.id;
        form.elements.image_key.value = data.item.image_key || "";
        setNode(msg, options.silent ? "" : "已保存", "ok");
        await loadCampaigns();
        return data.item;
      } catch (error) {
        setNode(msg, error.message || "保存失败", "bad");
        if (!options.silent) throw error;
        return null;
      } finally {
        if (button) button.dataset.state = "idle";
      }
    }

    async function uploadCampaignImage(file) {
      const form = $("#campaignForm");
      const msg = $("#formMsg");
      const localUrl = URL.createObjectURL(file);
      $("#dropzone").innerHTML = "<img alt='广告图预览' src='" + localUrl + "'>";
      warnImageRatio(file, localUrl);
      try {
        let campaignId = form.elements.id.value;
        if (!campaignId) {
          const draft = await saveCampaign({ forceDraft:true, silent:true });
          campaignId = draft?.id || "";
        }
        if (!campaignId) throw new Error("请先保存投放草稿");
        const data = new FormData();
        data.set("image", file);
        const result = await api("/api/admin/ad-campaigns/" + encodeURIComponent(campaignId) + "/image", { method:"POST", body:data });
        form.elements.image_key.value = result.item.image_key || "";
        form.elements.image_url.value = result.item.image_url || "";
        $("#dropzone").innerHTML = result.item.image_url ? "<img alt='广告图预览' src='" + esc(result.item.image_url) + "'>" : $("#dropzone").innerHTML;
        setNode(msg, "图片已上传", "ok");
      } catch (error) {
        setNode(msg, error.message || "图片上传失败", "bad");
      }
    }

    function campaignBody() {
      const form = $("#campaignForm");
      return {
        name: form.elements.name.value.trim(),
        enabled: form.elements.enabled.value === "1",
        image_url: form.elements.image_url.value.trim(),
        image_key: form.elements.image_key.value.trim(),
        click_url: form.elements.click_url.value.trim(),
        start_at: beijingLocalToIso(form.elements.start_at.value),
        end_at: beijingLocalToIso(form.elements.end_at.value),
        fit: form.elements.fit.value,
        width: form.elements.width.value.trim(),
        max_height: form.elements.max_height.value.trim(),
        rent_amount: form.elements.rent_amount.value.trim(),
        currency: form.elements.currency.value.trim(),
        billing_type: form.elements.billing_type.value,
        title: form.elements.title.value.trim(),
        alt: form.elements.alt.value.trim(),
        rent_note: form.elements.rent_note.value.trim(),
      };
    }

    async function createProject() {
      const name = prompt("项目名称，例如 Codex Session Patcher");
      if (!name) return;
      const id = prompt("项目 ID，例如 codex-session-patcher", slug(name));
      if (!id) return;
      await api("/api/admin/ad-projects", { method:"POST", body:{ id, name } });
      state.projectId = id;
      await loadProjects();
    }

    async function createSlot() {
      if (!state.projectId) return setGlobal("请先选择项目", "bad");
      const groupKey = prompt("页面 key，例如 enhance");
      const groupLabel = prompt("页面名称，例如 增强", groupKey || "");
      const positionKey = prompt("位置 key，例如 left");
      const positionLabel = prompt("位置名称，例如 左侧", positionKey || "");
      if (!groupKey || !positionKey) return;
      const item = await api("/api/admin/ad-projects/" + encodeURIComponent(state.projectId) + "/ad-slots", {
        method:"POST",
        body:{ group_key:groupKey, group_label:groupLabel || groupKey, position_key:positionKey, position_label:positionLabel || positionKey, suggested_ratio:"3:4", suggested_size:"1080 × 1440", enabled:true }
      });
      state.groupKey = item.item.group_key;
      await loadSlots();
    }

    async function loadIntents() {
      const params = new URLSearchParams();
      if ($("#source").value) params.set("source", $("#source").value);
      if ($("#status").value) params.set("status", $("#status").value);
      if ($("#q").value) params.set("q", $("#q").value);
      const data = await api("/api/admin/intents?" + params.toString());
      $("#intentRows").innerHTML = (data.items || []).map(item => "<tr><td>" + esc(item.created_at || "") + "</td><td>" + esc(item.source_name || item.source_id) + "</td><td>" + esc(item.intent_type_label) + "</td><td>" + esc(item.name) + "<br><span class='muted'>" + esc(item.contact) + "</span></td><td class='msg'>" + esc(item.message) + "</td><td><select data-intent='" + esc(item.id) + "'><option value='new' " + selected(item.status,"new") + ">未处理</option><option value='contacted' " + selected(item.status,"contacted") + ">已联系</option><option value='closed' " + selected(item.status,"closed") + ">已关闭</option></select></td></tr>").join("");
      $("#intentRows").querySelectorAll("[data-intent]").forEach(select => select.onchange = () => api("/api/admin/intents/" + encodeURIComponent(select.dataset.intent), { method:"PATCH", body:{ status:select.value } }));
    }

    function setView(view) {
      document.querySelectorAll(".nav [data-view]").forEach(link => {
        const active = link.dataset.view === view;
        link.classList.toggle("active", active);
        link.toggleAttribute("aria-current", active);
      });
      $("#adsView").classList.toggle("hidden", view !== "ads");
      $("#intentsView").classList.toggle("hidden", view !== "intents");
      if (view === "ads") loadProjects();
      if (view === "intents") loadIntents();
    }

    function warnImageRatio(file, url) {
      const image = new Image();
      image.onload = () => {
        const ratio = parseRatio(state.slot?.suggested_ratio);
        const actual = image.naturalWidth / image.naturalHeight;
        const deviation = ratio ? Math.abs(actual - ratio) / ratio : 0;
        const text = "图片尺寸 " + image.naturalWidth + " × " + image.naturalHeight;
        setNode($("#ratioMsg"), deviation > 0.08 ? text + "，和建议比例偏差较大" : text + "，比例合适", deviation > 0.08 ? "warn" : "ok");
      };
      image.src = url;
    }

    function field(name, label, value, placeholder = "", type = "text") {
      return "<label>" + label + "<input name='" + name + "' type='" + type + "' value='" + esc(value || "") + "' placeholder='" + esc(placeholder) + "'></label>";
    }

    function optionList(items, value) {
      return items.map(([key,label]) => "<option value='" + key + "' " + selected(value, key) + ">" + label + "</option>").join("");
    }

    function selected(value, key) {
      return value === key ? "selected" : "";
    }

    function showTime(value) {
      return isoToBeijingLocal(value).replace("T", " ") || "未设置";
    }

    function isoToBeijingLocal(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      return shifted.getUTCFullYear() + "-" + pad(shifted.getUTCMonth() + 1) + "-" + pad(shifted.getUTCDate()) + "T" + pad(shifted.getUTCHours()) + ":" + pad(shifted.getUTCMinutes());
    }

    function beijingLocalToIso(value) {
      const match = String(value || "").match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$/);
      if (!match) return "";
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0)).toISOString();
    }

    function parseRatio(value) {
      const match = String(value || "").match(/^(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?)$/);
      return match ? Number(match[1]) / Number(match[2]) : 0;
    }

    function setGlobal(text, type) {
      setNode($("#globalMsg"), text, type);
    }

    function setNode(node, text, type) {
      node.className = "status " + (type || "");
      node.textContent = text || "";
    }

    function debounce(fn, wait) {
      let timer;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, wait);
      };
    }

    function slug(value) {
      return String(value || "").trim().toLowerCase().replace(/[^a-z0-9:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    }
  </script>
</body>
</html>`;
}
