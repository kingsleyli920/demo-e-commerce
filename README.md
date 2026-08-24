# 云集优选 · AI 电商 Demo

[![CI](https://github.com/kingsleyli920/demo-e-commerce/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/kingsleyli920/demo-e-commerce/actions/workflows/ci.yml)

> 单商户、单仓的 Web 电商 Demo：商品目录/搜索 → SKU 选择 → 购物车 → Mock 结算与支付 → 订单状态流转 → 最小后台；完整自动化测试 + CI；并以仓库本身（计划、测试、提交历史、`AI_WORKFLOW.md`、ADR）展示人机协作过程。
>
> 接手入口：[`IMPLEMENTATION_BRIEF.md`](IMPLEMENTATION_BRIEF.md) · 验收依据：[`docs/plan/03-P0完成标准与测试矩阵.md`](docs/plan/03-P0完成标准与测试矩阵.md) · 验收结果：[`ACCEPTANCE_MATRIX.md`](ACCEPTANCE_MATRIX.md) · 测试报告：[`TEST_REPORT.md`](TEST_REPORT.md) · 协作记录：[`AI_WORKFLOW.md`](AI_WORKFLOW.md)
>
> 关键流程录屏（3 分 05 秒）：[`docs/screenshots/demo-p0-key-flows.webm`](docs/screenshots/demo-p0-key-flows.webm) · 截图见 [`docs/screenshots/`](docs/screenshots/)

## 快速开始（干净环境）

前置：Node ≥ 22、pnpm ≥ 10（`corepack enable` 即可）、Docker（Compose v2）。

```bash
cp .env.example .env.local          # 默认值可直接使用（建议把 BETTER_AUTH_SECRET / CRON_SECRET 换成随机串）
pnpm install
docker compose up -d                # PostgreSQL 16（宿主机端口 5433，避开本机常见的 5432；可用 POSTGRES_PORT 覆盖）
pnpm db:migrate && pnpm db:seed     # 建表 + 写入 28 类目 / 150 商品 / 640 SKU / 2 账号 / 4 地址 / 3 历史订单
pnpm dev                            # http://localhost:3000
```

演示账号（seed 写入，仅本地演示）：

| 角色   | 邮箱               | 密码          | 入口                  |
| ------ | ------------------ | ------------- | --------------------- |
| 买家   | `demo@shop.local`  | `Demo123456`  | `/login` 一键登录按钮 |
| 管理员 | `admin@shop.local` | `Admin123456` | 登录后访问 `/admin`   |

## 10 分钟演示路径（详见 docs/plan/01 §2）

1. `/login` 一键买家登录 → 首页类目 + 热销
2. 搜索「耳机」→ 价格升序 → 进入 Beats Flex 详情 → 选「黑色/标准版」（试试灰色：仅剩 3 件；黄色：已置灰）
3. 加购 → 购物车改数量/勾选 → 去结算 → 提交订单 → 收银台倒计时 → 模拟支付成功 → 订单「待发货」
4. 管理员 `/admin`：统计卡 → 商品管理搜「煎锅」→ 把 24cm 单锅库存改为 1 → 前台显示「仅剩 1 件」
5. 库存护栏：买家抢下最后 1 件后，第二账号购买被服务端拒绝（或跑 `pnpm exec vitest run tests/unit/inventory.concurrency.test.ts` 现场看 50 并发）
6. 后台发货 → 前台「待收货」→ 确认收货 → 「已完成」
7. 协作过程：`git log --oneline`（test 红 → feat 绿的 TDD 痕迹）→ `AI_WORKFLOW.md` → ADR → hooks/rules

## 常用命令

| 命令                                                       | 说明                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`                   | 开发 / 生产构建 / 生产启动                                                                         |
| `pnpm lint` / `pnpm typecheck`                             | ESLint / `next typegen && tsc --noEmit`                                                            |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:reset` | 生成迁移 / 迁移 / 重置并写入 seed / 清库重建                                                       |
| `pnpm test:unit`                                           | Vitest：`tests/unit`（直连 `shop_test`，串行）+ `tests/component`（jsdom）；覆盖率阈值 80/70/80/80 |
| `pnpm test:e2e`                                            | Playwright chromium：47 条用例；自动起 dev server，setup 阶段重置 seed（会清空开发库数据）         |
| `pnpm test`                                                | unit + e2e                                                                                         |
| `pnpm demo:record`                                         | 重新录制 3–5 分钟关键流程演示视频（写入 test-results/demo-video）                                  |

## 关键设计与口径

- **金额**：全程整数「分」，展示层 `formatPrice`；运费：商品合计 ≥ ¥99（9900 分）免运费，否则 ¥10。
- **库存**：`stock`（实物）/`locked_stock`（下单锁定）分离，可售 = 差值；下单用条件原子 UPDATE 锁定（并发不超卖有 50 并发单测与 E2E 护栏）；支付扣减、取消/超时释放，全程 `inventory_logs` 流水。
- **订单状态机**：`PENDING_PAYMENT → PAID → SHIPPED → COMPLETED`，`PENDING_PAYMENT → CANCELLED`（手动/15 分钟超时惰性取消 + `POST /api/cron/expire-orders` + 后台按钮）；Mock 支付回调幂等。
- **购物车角标口径**：**有效条目（SKU 上架且可售 > 0）的数量之和**（下架/售罄条目不计入）。
- **Mock 支付回调**：`POST /api/pay/mock` 要求登录且只能操作本人订单（演示用回调，无真实网关签名）。
- **鉴权**：Better Auth 邮箱密码；`/cart /checkout /orders /account/*` 需登录（proxy 302 + 页面级守卫），`/admin/*` 需管理员（403）；订单/地址仅本人可见（他人 404）。
- **测试分层**：服务层单测（103 条，直连测试库）→ 组件测试（jsdom）→ E2E（47 条，真实浏览器 + 完整 seed）→ 录屏冒烟；矩阵详见 `docs/plan/03`，结果见 `TEST_REPORT.md`。

## 目录

```text
src/app/(shop)     买家页    src/app/(admin)/admin  后台    src/app/api  auth / pay/mock / cron
src/server/db      Drizzle schema / client       src/server/services  业务 service（唯一写入口）
src/server/auth    Better Auth 实例与守卫         src/server/dto       zod 输入输出
src/components     UI（shadcn）与业务组件         src/lib              纯函数（金额/规格/库存提示…）
scripts/seed       seed 脚本与中文商品 JSON       scripts/demo         录屏用速览页
tests/{unit,component,e2e,demo}                  drizzle/             migrations（仅由 drizzle-kit 生成）
docs/{plan,adr,research,screenshots}             .claude/             rules / hooks / code-reviewer
```

## 里程碑

| 里程碑           | 状态                                     | 净耗时 / 预算 |
| ---------------- | ---------------------------------------- | ------------- |
| M1 骨架与数据    | ✅                                       | 0.65h / 5h    |
| M2 商品目录      | ✅                                       | ≈0.5h / 5h    |
| M3 交易闭环      | ✅                                       | ≈0.9h / 9h    |
| M4 后台与验收    | ✅                                       | ≈1.9h / 5h    |
| M5 AI 导购（P1） | 未启动（门槛检查见 `AI_WORKFLOW.md` §4） | — / 6h        |

> 净耗时为 Agent 对各阶段工作量的估算（非精确 wall-clock）；产品和技术层面人工介入 0 次，另有额度恢复后的运行续接 1 次（详见 `AI_WORKFLOW.md`）。

明确不做：真实支付、多商户、对外 MCP、营销玩法、物流对接、推荐、图搜、i18n、移动端、游客购物车、公网部署（完整清单见 `docs/plan/01` §1.3）。
