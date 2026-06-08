# Muggle Leads / 麻瓜合作台

统一收集多个本地工具的合作意向，保存到 Cloudflare D1，并通知到 Telegram。

## 功能

- `POST /api/sources/:source_id/intents`：接收合作意向。
- `GET /api/sources/:source_id/ad-slots`：返回该来源的广告位配置。
- `GET /admin`：查看后台。
- `GET /api/admin/intents`：按来源、状态、关键词筛选。
- `PATCH /api/admin/intents/:id`：更新状态。

后台文案统一使用“来源”，不使用“项目”。

## 官方线上地址

- 管理后台：`https://leads.3jiezhiwai.com/admin`
- Codex Session Patcher 提交接口：`https://leads.3jiezhiwai.com/api/sources/codex-session-patcher/intents`
- Codex Session Patcher 广告配置：`https://leads.3jiezhiwai.com/api/sources/codex-session-patcher/ad-slots`

## 数据字段

```json
{
  "source_id": "codex-session-patcher",
  "source_name": "Codex Session Patcher",
  "source_version": "1.4.5",
  "intent_type": "ads",
  "intent_type_label": "广告位出租",
  "name": "张三",
  "contact": "微信 xxx",
  "message": "想咨询广告位"
}
```

## 部署

1. 创建 D1 数据库。

```bash
npx wrangler d1 create muggle-leads-db
```

2. 把返回的 `database_id` 写入 `wrangler.toml`。

3. 执行数据库迁移。

```bash
npm run d1:migrate
```

4. 设置密钥。

```bash
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put TG_CHAT_ID
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put IP_HASH_SALT
```

5. 部署。

```bash
npm run deploy
```

6. 在 fork 项目或开发环境中覆盖远程提交地址。

```bash
export MUGGLE_LEADS_ENDPOINT="https://你的 Worker 域名/api/sources/codex-session-patcher/intents"
```

官方版 Codex Session Patcher 已内置作者自己的线上提交地址，普通用户不需要配置这个环境变量。

## 广告位配置

Codex Session Patcher 的广告位由作者部署的 Worker 控制，不由本地用户配置。前端默认读取：

```text
https://leads.3jiezhiwai.com/api/sources/codex-session-patcher/ad-slots
```

在 Cloudflare Worker 的环境变量里配置 `CODEX_SESSION_PATCHER_AD_SLOTS_JSON`，内容示例：

```json
{
  "version": 1,
  "slots": [
    {
      "tab": "enhance",
      "position": "left",
      "enabled": true,
      "image_url": "https://cdn.example.com/ad.png",
      "click_url": "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=915358515&card_type=group&source=qrcode",
      "alt": "广告图",
      "title": "点击加入 QQ 群",
      "width": "clamp(190px, 17vw, 320px)",
      "max_height": "72vh",
      "fit": "natural",
      "background": "var(--color-bg-1)"
    }
  ]
}
```

更换广告图、点击链接、尺寸或比例时，只修改这个环境变量。`image_url` 建议使用作者控制的 CDN、R2 或对象存储地址。

## 管理后台

打开：

```text
https://你的 Worker 域名/admin
```

使用 `ADMIN_TOKEN` 登录。后台支持按来源、状态和关键词筛选，并可把意向标记为：

- `new`：未处理
- `contacted`：已联系
- `closed`：已关闭

## 安全说明

- Telegram Bot token 只保存在 Cloudflare Worker secrets，不进入本地工具和前端构建产物。
- Worker 会拒绝称呼、联系方式和合作需求里的脚本标签、HTML 标签以及事件处理器样式内容；被拒绝的请求不会保存，也不会通知 Telegram。
- 提交接口按来源和 IP 哈希做 60 秒 3 次的简单限频。
- `IP_HASH_SALT` 用于生成不可逆的客户端标识，建议设置。
