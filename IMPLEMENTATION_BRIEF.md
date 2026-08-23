# IMPLEMENTATION_BRIEF — AI 电商 Demo（P0 收敛版）

> 面向**全新 Claude Code Session** 的接手文档。读完本文即可开工；需要细节时再按第 12 节链接深入。状态：v1.1（2026-08-22，用户已拍板全部决策）。
> 不要重新调研、不要引入本文与 `docs/plan/02` 之外的新工具/框架、不要扩大范围。遇到文档未覆盖的小决策：选最简单的做法，并记入 `AI_WORKFLOW.md`。

## 1. 30 秒摘要

- **做什么**：单商户、单仓的 Web 电商 Demo —— 商品目录/搜索 → SKU 选择 → 购物车 → Mock 结算与支付 → 订单状态流转 → 最小后台；**完整自动化测试 + CI**；以仓库本身（计划、测试、提交历史、AI_WORKFLOW 记录、ADR）展示人机协作过程。
- **约束**：P0 ≈ 24 小时（M1–M4）；10 分钟可完整演示；P1「AI 导购」（M5 ≈ 6h）**不自动开始**，必须满足第 8.2 节门槛；硬上限 30h。
- **不做**：真实支付、多商户、对外 MCP、营销玩法、物流对接、推荐、图搜、i18n、移动端、游客购物车、monorepo、向量检索、OpenSpec、全程录屏。
- **成功 =** `docs/plan/03-P0完成标准与测试矩阵.md` 全部勾选 + `docs/plan/01` 第 2 节演示脚本可按稿走完 + 3–5 分钟关键流程录屏。

## 2. 已确认决策（2026-08-22 用户拍板，不再询问）

| # | 决策 | 结果 |
|---|---|---|
| Q1 | 运行与演示环境 | **本地 Docker Compose + PostgreSQL 16**（不做 SQLite、不部署公网） |
| Q2 | UI 与商品文案语言 | **中文** |
| Q3 | 「AI 协作过程」展示方式 | **仓库留痕（提交历史 / AI_WORKFLOW.md / ADR / 测试 / Final PR）+ 一段 3–5 分钟关键流程录屏**；不引入 OpenSpec，不全程录屏 |
| 其它 | 已锁定 | Next.js 16 单仓；Drizzle + Postgres；Better Auth 邮箱密码 + 演示账号；单商户单仓；最小后台为页面；商品数据 = DummyJSON 骨架 → Claude 生成中文文案与多规格 SKU → 提交为仓库内 JSON；流程 = `docs/plan` + 测试即规格；P1 模型 `claude-sonnet-5` |

## 3. 技术栈（固定；版本以 `pnpm create next-app@latest` / npm latest 为准，写代码前用 context7 核对 API）

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router，Server Actions + Route Handlers）+ TypeScript，单仓 `src/` |
| UI | Tailwind CSS v4 + shadcn/ui（CLI + MCP）；`frontend-design` 插件辅助 |
| 数据 | Drizzle ORM + PostgreSQL 16（Docker Compose）；`drizzle-kit` migrations；金额整数「分」 |
| 鉴权 | Better Auth（邮箱密码）+ Drizzle adapter + `role` 字段；seed 两个账号 + 一键演示登录 |
| 测试 | Vitest（service 层，直连 `shop_test`）+ Playwright（E2E）+ GitHub Actions |
| P1 AI | Vercel AI SDK v7 + `@ai-sdk/anthropic`（`claude-sonnet-5`）+ AI Elements |

## 4. 仓库结构与分层约束

```text
demo-e-commerce/
├─ IMPLEMENTATION_BRIEF.md          # 本文
├─ AI_WORKFLOW.md                   # 人机协作记录（模板已建，逐里程碑填写）
├─ CLAUDE.md  .claude/{rules,agents,settings.json}
├─ docs/{research,plan,adr,screenshots}/
├─ src/app/                         # (shop)/ 买家页  (admin)/ 后台  api/{auth,pay,cron,chat}
├─ src/components/                  # ui/(shadcn) + 业务组件
├─ src/server/db/                   # schema.ts, client.ts
├─ src/server/services/             # catalog / cart / checkout / order / payment / inventory / address / admin / auth
├─ src/server/dto/                  # zod 输入输出 schema（Web / P1 AI 共用）
├─ src/ai/                          # P1：tools、prompts（M5 前不存在）
├─ drizzle/                         # migrations
├─ scripts/seed/                    # seed.ts + data/{categories,products}.zh.json
├─ tests/{unit,e2e}/  tests/factories.ts
├─ docker-compose.yml  .github/workflows/ci.yml
```

**红线**：① `src/server/services/**` 只依赖 `db` + `dto`，**不 import** `next/*`、React、AI SDK；② 所有写操作（加购/下单/支付/后台）走 service，页面与 Server Actions 只做参数校验与调用；③ 金额全程整数分，展示层再 `/100`；④ 不手改 migrations，改 schema 后 `pnpm db:generate`。

## 5. 数据模型（11 张业务表 + Better Auth 自动表）

| 表 | 关键字段与约束 |
|---|---|
| `users`（Better Auth 生成，additionalFields） | `role` ∈ {buyer, admin}，`name` |
| `addresses` | user_id, receiver, phone, province/city/district, detail, is_default；同一用户仅一个默认 |
| `categories` | id, parent_id(null=一级), name, slug unique, sort；2 级 |
| `products` | id, category_id(叶子), title, subtitle, brand, images json[], description, `attributes json [{name, values[]}]`, status ∈ {on, off}, min_price(分, 由 SKU 派生), sales_count, rating, created_at |
| `skus` | id, product_id, `spec json {颜色:"黑",版本:"标准"}`, `spec_key text`（按属性名排序序列化，`unique(product_id, spec_key)`）, price, original_price, stock, locked_stock, image, status ∈ {on, off}；`check(stock >= locked_stock >= 0)` |
| `carts` / `cart_items` | carts: user_id unique；items: cart_id, sku_id, quantity, selected, created_at；`unique(cart_id, sku_id)` |
| `orders` | id, order_no unique（`ORD` + yyyyMMddHHmmss + 4 随机）, user_id, status ∈ {PENDING_PAYMENT, PAID, SHIPPED, COMPLETED, CANCELLED}, total_amount, freight, pay_amount, address_snapshot json, remark, channel ∈ {web, ai_assistant}, expire_at, paid_at, shipped_at, completed_at, cancelled_at, shipping json{carrier, tracking_no}, created_at |
| `order_items` | order_id, sku_id, product_id, title_snapshot, spec_snapshot json, image_snapshot, unit_price, quantity, subtotal |
| `payments` | order_id, method ∈ {mock}, amount, status ∈ {INIT, SUCCESS, FAILED}, transaction_no unique, paid_at |
| `inventory_logs` | sku_id, change(±), type ∈ {lock, unlock, deduct, admin_adjust}, ref_order_id, created_at |

Seed（`scripts/seed/data/*.zh.json`，**提交进仓库、不依赖网络/API Key**）：6 个一级 + ≈20 个叶子类目；≥ 80 SPU、每 SPU 2–6 SKU（≥ 200 SKU），图片用 DummyJSON CDN 白底图 URL（`cdn.dummyjson.com`），文案中文；约 10% SKU 库存 ≤ 3、3% 售罄；账号 `demo@shop.local / Demo123456`（buyer）、`admin@shop.local / Admin123456`（admin），各 2 个地址；买家预置 3 笔订单（PAID / SHIPPED / COMPLETED）。生成 JSON 是 M1 的一项任务（由 Claude 在会话内生成并提交）。

## 6. 业务规则（核心规则，实现时逐条对照；超预算时不可跳过）

1. **可售库存** = `stock - locked_stock`；详情页提示：>5 不提示、1–5「仅剩 N 件」、0「已售罄」并禁用购买。
2. **下单**（事务）：校验每项 SKU 上架 + 价格以服务端为准 → 逐 SKU `UPDATE skus SET locked_stock = locked_stock + :q WHERE id = :id AND stock - locked_stock >= :q`，影响行数 0 → 抛「库存不足: <sku>」并回滚 → 写 orders（PENDING_PAYMENT, `expire_at = now + ORDER_EXPIRE_MINUTES`）/ order_items 快照 / payments(INIT) / inventory_logs(lock) → 从购物车删除对应已勾选项（立即购买不动购物车）。
3. **运费**：商品合计 ≥ 9900 分免运费，否则 1000 分；`pay_amount = total_amount + freight`。
4. **Mock 支付** `POST /api/pay/mock {orderNo, result, transactionNo}`：success → payments SUCCESS + orders PAID + `stock -= q, locked -= q` + logs(deduct)；fail → payments FAILED、订单仍 PENDING 可重试；**幂等**：同 transactionNo 重复 / 订单已 PAID → 返回成功不重复扣减；订单 CANCELLED → 400。
5. **状态机**：PENDING_PAYMENT→PAID→SHIPPED→COMPLETED；PENDING_PAYMENT→CANCELLED（用户取消 / 超时）；其余迁移抛错；每次迁移写对应时间戳。
6. **超时**：读取订单（详情/列表/支付页）时若 `PENDING_PAYMENT && expire_at < now` → 取消并释放库存（logs unlock）；`POST /api/cron/expire-orders`（header `x-cron-secret`）与后台按钮批量处理。
7. **购物车**：同 SKU 合并；`1 ≤ qty ≤ min(可售, 99)`；条目 ≤ 50；SKU 下架或可售 0 → 标记失效、不可勾选、不计合计；结算预览与提交都重新校验。
8. **鉴权**：`/cart /checkout /orders /account/*` 需登录；`/admin/*` 需 `role=admin`（Next 16 `proxy.ts` 或 layout 级校验，二选一）；订单只能查看本人（他人 → 404）。
9. **后台**：库存编辑不得 < locked_stock；发货仅 PAID→SHIPPED（可填 carrier/tracking_no）；上下架即时生效。

## 7. 路由清单

| 类型 | 路由 |
|---|---|
| 买家 | `/`, `/search`, `/c/[slug]`, `/p/[id]`, `/cart`, `/checkout`, `/pay/[orderNo]`, `/orders`, `/orders/[orderNo]`, `/account/addresses`, `/login` |
| 后台 | `/admin`, `/admin/products`, `/admin/products/[id]`, `/admin/orders`, `/admin/orders/[orderNo]` |
| API | `/api/auth/[...all]`（Better Auth）, `POST /api/pay/mock`, `POST /api/cron/expire-orders`；其余写操作用 Server Actions；P1：`/api/chat` |

## 8. 里程碑与 DoD（每个里程碑独立可验收；在同一 `dev` 分支上以清晰提交组交付）

| 里程碑 | 预算 | DoD（摘要，全文见 docs/plan/01 §4 与 03） |
|---|---|---|
| M1 骨架与数据 | 5h | `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` 可跑；`/` 从 DB 渲染商品；登录/登出；CI 骨架绿；CLAUDE.md/rules/hooks；ADR×3；AI_WORKFLOW.md M1 段填写；提交 `chore(m1): 验收通过` |
| M2 商品目录 | 5h | P0-2/P0-3 验收项全过；unit `catalog.*` + e2e `browse-search`/`pdp-sku` 绿；AI_WORKFLOW M2 段；`chore(m2)` |
| M3 交易闭环 | 9h | P0-4～P0-7 全过；**并发不超卖**、支付幂等、状态机单测绿；e2e `cart-ops`/`checkout-pay`/`checkout-fail-retry`/`order-lifecycle`/`stock-guard` 绿；AI_WORKFLOW M3 段；`chore(m3)` |
| M4 后台与验收 | 5h | P0-8～P0-10 全过；e2e `admin-flow`/`admin-guard`/`full-journey` 绿；README（运行/演示/账号/CI 徽章）、`docs/screenshots/` 截图 + **3–5 分钟关键流程录屏**、AI_WORKFLOW 汇总耗时；`chore(m4)`；tag `p0-done`；**独立 Review → Final PR `dev → main`** |
| M5 AI 导购（P1） | 6h | **仅当满足 8.2 门槛**；聊天抽屉 + 7 工具 + 卡片 + 下单预览确认 + 10 条评测 ≥ 9 过；单独 PR；tag `p1-done` |

### 8.1 超预算规则（任一里程碑超预算 30% 时触发）

- **可以删减**：UI 精修（动效、空态美化、响应式细节、视觉打磨）、额外抽象（泛化 repository 层、过早的组件/hook 拆分、多余的配置化）、非核心细节（docs/plan/01 §1.1「不在 P0 内的细节」列及类似项）。
- **不可删减**：`docs/plan/03` 的任何验收项、任何已规划的测试用例、第 6 节任何业务规则。范围只能向 P1 推迟 P1 项，不能弱化 P0。
- 超预算必须记入 `AI_WORKFLOW.md`（原因、删减项、剩余预算）。

### 8.2 M5 启动门槛（三条同时满足才开始，否则 P1 仅保留设计）

1. M1–M4 全部验收通过（`docs/plan/03` 全勾选，`pnpm test` 与 CI 绿）。
2. **独立 Review 无 Critical/High 问题**：用 `/code-review`（或 `.claude/agents/code-reviewer.md` 只读 subagent）对 `dev` 相对 `main` 的全部变更做一次审查，Critical/High 修复并复验，结果记入 `AI_WORKFLOW.md` 第 3 节。
3. 累计用时 ≤ 24h 且**剩余时间 ≥ 6h**（以 AI_WORKFLOW 总览表为准）。

## 9. 工作方式（项目的展示重点，必须遵守）

1. **Git**：`main` 只接收 PR；开发全部在单一 `dev` 分支。每个里程碑以清晰提交组交付：Conventional Commits + 里程碑 scope（`feat(m2): …`、`test(m3): …`、`docs(m1): …`），里程碑结束一条 `chore(mN): milestone N 验收通过（测试 X/Y，耗时 Zh）`；必要时打 tag（建议仅 `p0-done`、`p1-done`）。**P0 完成 → 独立 Review → Final PR `dev → main`**（PR 描述：范围 / 验收勾选 / 测试输出 / AI_WORKFLOW 链接 / 录屏链接）；M5 若启动，在 `dev` 继续并单独 PR。
2. **提交纪律**：service 层功能**先 `test(mN):` 提交（红）再 `feat(mN):` 提交（绿）**；每条提交末尾 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
3. **AI_WORKFLOW.md**（根目录，模板已建）：每个里程碑填写关键 Prompt、模型选择、实际使用的 Skills/Plugins/MCP、人工决策、失败与恢复、人工介入次数、耗时、测试结果；P0 完成后填写独立 Review 与 M5 门槛检查；Final PR 前填写汇总。**这是协作展示的主证据，不得事后补写。**
4. **ADR**：M1 写 `docs/adr/0001-范围收敛.md`、`0002-技术栈.md`、`0003-库存与订单规则.md`（各 ≤ 40 行，内容取自本文第 1/2/3/6 节）。
5. **CLAUDE.md**（< 150 行）+ `.claude/rules/{server,ui,tests}.md` + hooks（PostToolUse 格式化；PreToolUse 拦 `rm -rf`/`drizzle-kit drop`/`git push --force`）+ `code-reviewer` 只读 subagent（每个里程碑验收前跑一次，P0 完成后做独立 Review）。
6. **验证**：每个里程碑结束运行 `pnpm test` 并把输出摘录进 AI_WORKFLOW；M4 前跑 `full-journey` 冒烟；录屏在 `full-journey` 绿之后录制。
7. **不做的事**：不新增依赖清单外的库（需要时先在 AI_WORKFLOW 写理由）；不做 P1/P2；不改数据库方言；不建多分支/多 PR。

## 10. 首个会话起手步骤（M1）

1. 读本文 + `docs/plan/02-第一天安装清单.md` + `AI_WORKFLOW.md` 填写规则；在 AI_WORKFLOW 记录 M1 开始时间。
2. 仓库已 `git init`（`main` 上有文档提交，含基础 `.gitignore`）：`git checkout -b dev`；后续按需补充 `.gitignore`。
3. 按 `docs/plan/02` §2 脚手架 + Docker Postgres + 依赖；写 `CLAUDE.md`/rules/hooks/`code-reviewer`。
4. `src/server/db/schema.ts`（第 5 节）→ `pnpm db:generate && pnpm db:migrate`。
5. 生成 `scripts/seed/data/{categories,products}.zh.json`（第 5 节规模）与 `seed.ts`；`pnpm db:seed`。
6. Better Auth（邮箱密码 + role）+ `/login`（一键演示登录）+ 登录态头部。
7. `/` 最小商品网格（从 DB 读）；Vitest/Playwright 配置 + 各 1 条冒烟测试；`.github/workflows/ci.yml`。
8. ADR×3；填写 AI_WORKFLOW M1 段；`chore(m1): milestone 1 验收通过 …` 提交。

## 11. 演示账号与命令速查

```bash
docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev   # http://localhost:3000
pnpm test:unit   pnpm test:e2e   pnpm test   pnpm db:reset
# 买家 demo@shop.local / Demo123456    管理员 admin@shop.local / Admin123456
```

## 12. 参考文档（按需深入）

- 人机协作记录模板与填写规则：`AI_WORKFLOW.md`
- 范围/演示/决策/里程碑：`docs/plan/01-MVP落地规划.md`
- 安装与配置：`docs/plan/02-第一天安装清单.md`
- 逐功能验收与测试用例：`docs/plan/03-P0完成标准与测试矩阵.md`
- 背景调研（不必通读）：`docs/research/01`（电商功能与数据模型坑）、`02`（工具与 AI SDK/护栏）、`03`（技术栈对比、仓库结构、AI 架构图）
- 扩展版历史规划（已归档，仅供范围对照）：`docs/plan/archive/`
