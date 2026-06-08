# 广告投放后台设计

## 目标

把 Muggle Leads 的广告管理从“手写 JSON / 改环境变量”升级为可直接使用的后台投放系统。作者登录后台后，可以按项目管理广告位，上传广告图，配置投放时间、租金、点击链接和显示方式。前台只读取当前有效广告，到期自动下架。

## 非目标

- 不接支付，不做订单、发票、收款状态。
- 不做广告点击统计、曝光统计或转化分析。
- 不做多广告轮播或随机展示。
- 不做图片自动裁剪，避免破坏客户提供的广告图。

## 关键决策

- 数据拆成三层：项目、广告位、投放。
- 同一个广告位同一时间只允许一条投放；时间区间按左闭右开处理，即 `start_at <= now < end_at`，结束时间等于下一条开始时间不算冲突。
- 投放状态由“启用状态 + 当前时间”计算，不手写 `已排期 / 投放中 / 已过期`。
- 后台输入和展示时间使用北京时间；数据库保存 ISO 时间。
- 租金只作为后台管理字段，不影响前台展示。
- 每个广告位提供建议宽高比和建议尺寸，上传图片时提示比例是否匹配，但不强制拦截。默认判断阈值为 8%，实际图片宽高比和建议宽高比偏差超过 8% 时提示。

## 数据模型

### 项目 project

项目代表一个接入广告系统的产品。

- `id`：项目标识，例如 `codex-session-patcher`。
- `name`：项目名称，例如 `Codex Session Patcher`。
- `created_at` / `updated_at`：创建和更新时间。

首版预置 `Codex Session Patcher`，后台支持新增项目。

### 广告位 ad_slot

广告位代表项目里长期存在的位置。

- `id`：广告位 ID。
- `project_id`：所属项目。
- `group_key`：页面或分组标识，例如 `enhance`。
- `group_label`：页面或分组名称，例如 `增强`。
- `position_key`：位置标识，例如 `left` / `right`。
- `position_label`：位置名称，例如 `左侧` / `右侧`。
- `suggested_ratio`：建议宽高比，例如 `3:4`。
- `suggested_size`：建议尺寸说明，例如 `1080 × 1440`。
- `default_fit`：默认显示方式，例如 `natural`。
- `default_width`：默认广告宽度，例如 `clamp(190px, 17vw, 320px)`。
- `default_max_height`：默认最高显示高度，例如 `72vh`。
- `enabled`：是否启用这个广告位。

首版预置 `Codex Session Patcher` 的 4 个页面 × 左右两侧，共 8 个广告位。

### 投放 campaign

投放代表某个广告客户在某个广告位上的一次排期。

- `id`：投放 ID。
- `slot_id`：所属广告位。
- `name`：投放名称，方便后台识别。
- `image_url` / `image_key`：外部图片地址或 R2 图片 key。
- `click_url`：点击链接，支持 `https://` 和 `mqqapi://`。
- `alt` / `title`：图片说明和提示文案。
- `fit`：显示方式，支持 `natural`、`contain`、`cover`、`fill`。
- `width` / `max_height`：覆盖广告位默认尺寸。
- `start_at` / `end_at`：生效起止时间。
- `enabled`：是否启用。
- `activated_at`：首次启用时间，用来区分草稿和已停用。
- `rent_amount`：租金金额。
- `currency`：币种，默认 `CNY`。
- `billing_type`：计费方式，支持 `one_time`、`yearly`、`monthly`、`weekly`、`daily`。
- `rent_note`：租金备注。
- `created_at` / `updated_at`：创建和更新时间。

## 状态规则

后台展示状态由以下规则计算：

- `草稿`：`enabled = false`，且从未启用。
- `已停用`：`enabled = false`，且历史上启用过。
- `已排期`：`enabled = true`，当前时间早于 `start_at`。
- `投放中`：`enabled = true`，且 `start_at <= now < end_at`。
- `已过期`：`enabled = true`，且 `now >= end_at`。

公开接口只返回 `投放中` 的广告。

## 后台交互

### 项目选择

后台进入“广告位”后，先选择项目。默认选中 `Codex Session Patcher`。项目列表旁提供“新增项目”入口。

### 广告位分组

选中项目后，按广告位的 `group_label` 显示 tab。例如 `Codex Session Patcher` 显示：

- 增强
- 设置
- 帮助
- 合作

每个 tab 内只显示该页面的广告位，例如左侧和右侧。

### 广告位详情

点击广告位后，右侧或下方显示该广告位详情：

- 建议比例和建议尺寸。
- 当前投放状态。
- 投放列表。
- 新建投放按钮。

### 投放编辑

投放编辑表单包含：

- 投放名称。
- 上传/预览区。
- 点击链接。
- 开始时间和结束时间。
- 显示方式和尺寸。
- 租金金额、币种、计费方式、备注。
- 保存草稿、启用、停用。

上传/预览区合并为一个控件：

- 点击预览区选择图片。
- 拖拽图片到预览区上传。
- 选择图片后立即本地预览。
- 如果图片比例和广告位建议比例偏差超过 8%，显示提醒，但仍允许保存。

## 前台接口

前端继续读取：

```text
GET /api/sources/:source_id/ad-slots
```

返回当前项目所有正在投放的广告，结构保持兼容：

```json
{
  "version": 1,
  "slots": [
    {
      "tab": "enhance",
      "position": "left",
      "enabled": true,
      "image_url": "https://example.com/ad.png",
      "click_url": "mqqapi://...",
      "alt": "广告图",
      "title": "点击查看",
      "width": "clamp(190px, 17vw, 320px)",
      "max_height": "72vh",
      "fit": "natural",
      "background": "var(--color-bg-1)"
    }
  ]
}
```

前端不需要知道项目、广告位和投放三层结构。

## 错误处理

- 上传图片类型不支持时，提示只支持 PNG、JPG、WebP、GIF。
- 图片超过大小限制时，提示压缩后再上传。
- 保存草稿允许缺少图片、点击链接、开始时间和结束时间。
- 启用投放时必须有图片、开始时间和结束时间，且 `end_at > start_at`。
- 启用投放时如果同一广告位存在时间重叠，保存失败并提示冲突投放。
- R2 未绑定或上传失败时，允许改用外部图片 URL。
- D1 未迁移时，后台显示“广告位数据库未初始化”。

## 迁移策略

本功能尚未正式上线，不需要兼容上一版临时 `ad_slots` 表。实现时可以在新迁移中删除临时表并重建三层模型。

最终表：

- `ad_projects`
- `ad_slots`
- `ad_campaigns`

迁移后写入默认数据：

- `Codex Session Patcher` 项目。
- `enhance / settings / help / cooperation` 四个分组。
- 每个分组 `left / right` 两个广告位。

公开接口保持不变，前端不需要跟随后端表结构调整。

## 验证方式

- Worker 单元测试覆盖项目、广告位、投放保存、时间冲突、公开接口只返回当前有效投放。
- 上传图片测试覆盖 R2 写入和预览 URL 返回。
- 后台 HTML 通过 UI review。
- 前端构建通过，确认公开接口结构未破坏。
- 线上部署后验证：
  - `/admin` 可登录。
  - 后台能新增项目、广告位和投放。
  - 到期投放不会出现在公开接口。
  - 时间重叠投放不能保存。
