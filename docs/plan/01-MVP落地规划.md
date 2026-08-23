# AI 电商 Demo — MVP 落地规划（收敛版 v1.1）

> 文档状态：**v1.1 收敛版（2026-08-22，全部决策已拍板）**。目标从「4–5 周扩展版」收敛为 **24–30 小时可完成、10 分钟可完整演示**；项目重点是**展示「我如何与 AI 协作完成开发」**，而不是做商业级电商平台。
> 扩展版历史稿见 [archive/01-MVP落地规划-v0.2-扩展版.md](archive/01-MVP落地规划-v0.2-扩展版.md)；开发接手入口见仓库根目录 [`IMPLEMENTATION_BRIEF.md`](../../IMPLEMENTATION_BRIEF.md)；协作记录模板见 [`AI_WORKFLOW.md`](../../AI_WORKFLOW.md)；逐功能验收标准见 [03-P0完成标准与测试矩阵](03-P0完成标准与测试矩阵.md)。

---

## 0. 一页纸摘要

| 项 | 结论 |
|---|---|
| 定位 | 一个**真实跑通「找商品 → 选 SKU → 加购 → Mock 结算支付 → 订单流转」闭环**的 Web 电商 Demo，带最小后台与完整自动化测试；并以仓库本身（计划、测试、提交历史、AI_WORKFLOW、ADR、Final PR）展示人机协作过程 |
| 时间盒 | **P0 ≈ 24h**（M1–M4）；**P1 AI 导购 ≈ 6h**（M5，**不自动开始**，见第 4.2 节门槛）；硬上限 30h |
| 演示 | 10 分钟现场：4 分钟产品闭环 + 3 分钟协作过程 + 2 分钟 AI 导购（若完成）+ 1 分钟收尾；另交付一段 **3–5 分钟关键流程录屏** |
| 技术栈 | Next.js 16（App Router）单仓 + TypeScript + Tailwind v4 + shadcn/ui + Drizzle + PostgreSQL（Docker）+ Better Auth；P1 加 Vercel AI SDK v7 + Claude |
| 数据 | 单商户、单仓、中文商品 ≈ 80 SPU / 200+ SKU / 2 级类目；seed 数据为仓库内 JSON（由 Claude 基于 DummyJSON 骨架生成） |
| 决策 | **全部已拍板**（第 3 节），开发阶段不再询问 |

---

## 1. 范围：P0 / P1 / 不做

### 1.1 P0（24h 内必须完成，缺一不可）

| # | 模块 | 最小能力 | 不在 P0 内的细节 |
|---|---|---|---|
| P0-1 | 账号（最小） | 邮箱密码登录/登出；两个 seed 账号（买家/管理员）+「一键演示登录」按钮；角色守卫 | 注册、找回密码、第三方登录 |
| P0-2 | 商品目录与搜索 | 2 级类目、商品列表分页（20/页）、关键词搜索（标题/品牌/副标题）、类目筛选（含子类目）、价格区间、排序（综合/销量/价格升降/新品）、仅展示上架商品 | 联想词、同义词、属性筛选、向量检索 |
| P0-3 | 商品详情与 SKU | 图集、标题/副标题/品牌、规格联动选择 → 定位 SKU、SKU 价格/原价/库存提示（仅剩 N 件 / 已售罄）、加购、立即购买、详情描述 | 评价、问答、相似推荐 |
| P0-4 | 库存 | `stock` / `locked_stock`；下单原子锁定、支付成功扣减、取消/超时释放；InventoryLog 流水；**并发不超卖** | 多仓、预警 |
| P0-5 | 购物车 | 用户绑定；加购合并同 SKU；数量 ≤ min(可售库存, 99)；删除；选中/全选；失效（下架/售罄）标识且不可勾选；合计 | 游客购物车合并、收藏、凑单 |
| P0-6 | Mock Checkout | 地址 CRUD + 默认地址；结算预览（服务端算：商品合计、运费满 99 包邮否则 10 元、应付）；提交订单（价格/库存二次校验、快照、锁库存、15 分钟过期）；Mock 支付页（成功/失败）；回调幂等；超时自动取消（惰性 + 手动触发端点） | 优惠券、发票、多支付方式、真实网关 |
| P0-7 | 订单 | 列表 Tab（全部/待付款/待发货/待收货/已完成/已取消）、详情（商品快照、地址快照、金额、状态时间线）、取消（仅待付款）、确认收货（仅已发货）、再次支付 | 退款/售后、物流轨迹、评价 |
| P0-8 | 最小后台 | `/admin` 仅管理员：统计卡片（今日订单、已支付 GMV、待发货、售罄 SKU）；商品列表 + 上下架 + SKU 价格/库存编辑；订单列表/详情 + 模拟发货 +「处理超时订单」按钮 | 新建商品、类目管理、Banner、数据看板 |
| P0-9 | 完整测试 + CI | service 层单元/集成测试（含并发不超卖、状态机、支付幂等）、Playwright E2E（主路径 8 条 + 守卫 3 条）、GitHub Actions（lint/typecheck/unit/build/e2e） | 视觉回归、性能测试 |
| P0-10 | AI 协作留痕 | 单一 `dev` 分支上按里程碑分组的清晰提交（Conventional Commits + scope + `Co-Authored-By`，测试先行痕迹）；`AI_WORKFLOW.md` 逐里程碑填写；3 条 ADR；`CLAUDE.md` + `.claude/rules` + hooks；P0 完成后独立 Review + Final PR；3–5 分钟关键流程录屏 | 每里程碑单独分支/PR、OpenSpec、全程录屏 |

### 1.2 P1（仅在满足第 4.2 节门槛时才做；否则只保留设计）

| # | 模块 | 内容 |
|---|---|---|
| P1-1 | **AI 导购（M5）** | 全局聊天抽屉；工具：`search_catalog / get_product / compare_products / get_cart / update_cart / create_checkout_preview / get_orders`；对话内渲染商品卡/对比表/购物车卡/订单预览卡；`create_checkout_preview` 需用户点击「确认并去支付」才建单（AI 无支付能力）；`Order.channel = ai_assistant`；10 条工具调用评测用例 |
| P1-2 | 订单 Mock 物流轨迹、评价展示（seed 只读）、首页 Banner 配置、优惠券（固定金额+门槛） | 按时间择一二 |

### 1.3 明确不做

真实支付网关、多商户/店铺分组、**对外 MCP Server**、营销玩法（秒杀/拼团/满减叠加）、物流对接、推荐算法、图搜/试穿、多语言多币种、移动端 App、游客购物车、监控/告警/运维、monorepo、向量检索、OpenSpec、全程录屏、公网部署。

---

## 2. 10 分钟演示脚本

| 时间 | 段落 | 内容 |
|---|---|---|
| 0:00–1:00 | 开场 | 一句话定位；打开仓库：`IMPLEMENTATION_BRIEF.md` → `docs/plan` → `tests/` → CI 绿 |
| 1:00–5:00 | 产品闭环 | 首页 → 搜「耳机」筛价格排序 → 详情选「黑色/标准版」看库存 → 加购 → 购物车改数量/全选 → 结算选地址 → 提交 → Mock 支付成功 → 订单「待发货」→ 后台模拟发货 → 前台「确认收货」→ 已完成；**库存演示**：后台把某 SKU 库存改为 1，两个窗口同时下单只成功一个（或现场跑并发测试） |
| 5:00–8:00 | 协作过程 | `git log --oneline` 按里程碑分组的提交（test → feat 的 TDD 痕迹、Co-Authored-By）→ `AI_WORKFLOW.md`（关键 Prompt、人工介入次数、失败恢复、耗时 vs 预算、测试结果）→ `CLAUDE.md`/rules/hooks → ADR → Final PR 与独立 Review 结论 |
| 8:00–9:30 | AI 导购（若完成） | 「300 以内跑步用的蓝牙耳机」→ 商品卡 →「第 1 个加 2 个」→ 购物车卡 →「下单寄到默认地址」→ 预览卡 → 点「确认并去支付」 |
| 9:30–10:00 | 收尾 | 明确不做的事、P1/下一步、耗时统计（AI_WORKFLOW 汇总） |

**关键流程录屏（3–5 分钟，M4 交付）**：覆盖「产品闭环」段的主路径 + 库存并发演示 + 30 秒 `AI_WORKFLOW.md`/提交历史速览；在 `full-journey` E2E 绿之后录制，文件放 `docs/screenshots/`（或 README 链接）。

---

## 3. 决策记录（2026-08-22 全部拍板）

| # | 决策 | 结果 | 备注 |
|---|---|---|---|
| Q1 | 运行与演示环境 | **本地 Docker Compose + PostgreSQL 16** | 不做 SQLite 方言、不部署公网 |
| Q2 | UI 与商品文案语言 | **中文** | UI 文案不预留 i18n |
| Q3 | 协作过程展示方式 | **仓库留痕 + 一段 3–5 分钟关键流程录屏** | 不引入 OpenSpec、不全程录屏 |
| — | 其它 | Next.js 16 单仓；Drizzle + Postgres；Better Auth 邮箱密码 + 演示账号；单商户单仓；最小后台为页面；商品数据 = DummyJSON 骨架 → Claude 生成中文文案与多规格 SKU → 仓库内 JSON；流程 = 本目录计划 + 测试即规格；P1 模型 `claude-sonnet-5` | 开发阶段不再询问；如需变更先写入 AI_WORKFLOW「人工决策」再执行 |

---

## 4. 里程碑（可独立验收；单一 `dev` 分支，按里程碑分组提交）

| 里程碑 | 预算 | 交付 | 验收（DoD） |
|---|---|---|---|
| **M1 骨架与数据** | ≈5h | 脚手架（Next 16 + TS + Tailwind + shadcn）、Docker Postgres、Drizzle schema + migration（11 张表）、seed（≥80 SPU / ≥200 SKU / 2 级类目 / 2 账号 / 4 地址 / 3 历史订单）、Better Auth + 演示登录、`CLAUDE.md` + rules + hooks + code-reviewer、CI 骨架、ADR×3、AI_WORKFLOW M1 段 | `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` 可跑；`/` 能从 DB 渲染商品网格；登录/登出可用；CI（lint/typecheck/unit 占位）绿；提交 `chore(m1): milestone 1 验收通过 …` |
| **M2 商品目录** | ≈5h | 首页、搜索/类目列表（筛选/排序/分页）、详情页 + SKU 选择器 + 库存提示 + 加购/立即购买（加购先落到 M3 的 cart service 最小实现） | 03 文档 P0-2/P0-3 全部验收项通过；对应单测 + E2E `browse-search`、`pdp-sku` 通过；AI_WORKFLOW M2 段；`chore(m2)` |
| **M3 交易闭环** | ≈9h | 购物车、地址、结算预览、提交订单（锁库存/快照/过期）、Mock 支付 + 回调幂等、超时取消、订单列表/详情/取消/确认收货 | 03 文档 P0-4～P0-7 全部验收项通过；**并发不超卖测试通过**；状态机/幂等单测通过；E2E `cart-ops`、`checkout-pay`、`checkout-fail-retry`、`order-lifecycle`、`stock-guard` 通过；AI_WORKFLOW M3 段；`chore(m3)` |
| **M4 后台与验收** | ≈5h | `/admin` 统计/商品/订单/发货/超时处理 + 角色守卫；E2E 全链路；README（运行/演示/账号/CI 徽章）、验收清单勾选、截图 + 3–5 分钟录屏、AI_WORKFLOW 汇总耗时 | 03 文档 P0-8/P0-9/P0-10 通过；E2E `admin-flow`、`admin-guard`、`full-journey` 通过；CI 全绿；10 分钟演示脚本可按稿走完；`chore(m4)`；tag `p0-done`；**独立 Review → Final PR `dev → main`** |
| **M5 AI 导购（P1）** | ≈6h | 聊天抽屉、7 个工具、卡片渲染、下单预览确认流、渠道归因、10 条评测用例 | **仅当 4.2 门槛满足**；演示脚本 8:00–9:30 段可走；评测 ≥ 9/10；单独 PR；tag `p1-done` |

时间预算合计：P0 24h（含 ~1h 缓冲）；P1 6h；上限 30h。

### 4.1 超预算规则（任一里程碑超预算 30% 时触发）

- **可以删减**：UI 精修（动效、空态美化、响应式细节、视觉打磨）、额外抽象（泛化 repository 层、过早的组件/hook 拆分、多余的配置化）、非核心细节（§1.1 右列及类似项）。
- **不可删减**：`03` 文档的任何验收项、任何已规划测试、`IMPLEMENTATION_BRIEF.md` §6 的任何业务规则。只能把 P1 项推迟，不能弱化 P0。
- 触发与处理必须记入 `AI_WORKFLOW.md`（原因、删减项、剩余预算）。

### 4.2 M5 启动门槛（三条同时满足；不自动开始）

1. M1–M4 全部验收通过（`03` 全勾选，`pnpm test` 与 CI 绿）。
2. **独立 Review 无 Critical/High**：用 `/code-review` 或 `code-reviewer` 只读 subagent 审查 `dev` 相对 `main` 的全部变更，Critical/High 修复并复验，结论记入 `AI_WORKFLOW.md` 第 3 节。
3. 累计用时 ≤ 24h 且剩余 ≥ 6h（以 AI_WORKFLOW 总览表为准）。

---

## 5. 关键业务规则（速查，完整版见 IMPLEMENTATION_BRIEF §6；超预算时不可跳过）

- 金额单位：**分**（整数）；运费：商品合计 ≥ 9900 分免运费，否则 1000 分。
- 订单状态机：`PENDING_PAYMENT → PAID → SHIPPED → COMPLETED`；`PENDING_PAYMENT → CANCELLED`（用户取消 / 15 分钟超时）；非法迁移抛错。
- 库存：提交订单 `UPDATE skus SET locked_stock = locked_stock + q WHERE id = ? AND stock - locked_stock >= q`（影响行数 0 → 库存不足，整单回滚）；支付成功 `stock -= q, locked_stock -= q`；取消/超时 `locked_stock -= q`；每步写 `inventory_logs`。
- 快照：`order_items` 存标题/规格/图片/单价；`orders.address_snapshot` 存地址；购物车显示实时价。
- 支付回调幂等：同 `transaction_no` 重复 → 直接成功；订单已 `PAID` → 直接成功；订单已 `CANCELLED` → 拒绝并记录。
- 购物车：`(cart_id, sku_id)` 唯一；数量 ≤ min(可售库存, 99)；条目 ≤ 50；失效项不可勾选、结算时再次校验。

---

## 6. 风险与应对

| 风险 | 应对 |
|---|---|
| Next 16 / Better Auth API 与记忆不一致 | 写代码前用 context7 查当前文档；鉴权若 >1.5h 未通，退化为最小 cookie session（仍保留 seed 账号与角色），并记入 AI_WORKFLOW「失败与恢复」 |
| 范围回弹（想加评价/优惠券/AI） | 一律进 P1 列表，P0 验收前不碰 |
| 并发测试不稳定 | 在单进程内用连接池并发 50 次调用 service，不依赖浏览器 |
| 时间超支 | 每个里程碑结束在 AI_WORKFLOW 记录耗时；超 30% 触发 §4.1（只删精修/抽象/非核心细节） |
| 演示现场网络/API 不可用 | P0 全程离线可跑；P1 AI 导购在模型不可用时降级为关键词搜索；录屏作为兜底 |
