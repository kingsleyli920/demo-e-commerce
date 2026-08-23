# 云集优选 · AI 电商 Demo

> 单商户、单仓的 Web 电商 Demo：商品目录/搜索 → SKU 选择 → 购物车 → Mock 结算与支付 → 订单状态流转 → 最小后台；完整自动化测试 + CI；并以仓库本身（计划、测试、提交历史、`AI_WORKFLOW.md`、ADR）展示人机协作过程。
>
> 接手入口：[`IMPLEMENTATION_BRIEF.md`](IMPLEMENTATION_BRIEF.md) · 验收依据：[`docs/plan/03-P0完成标准与测试矩阵.md`](docs/plan/03-P0完成标准与测试矩阵.md) · 协作记录：[`AI_WORKFLOW.md`](AI_WORKFLOW.md)

## 快速开始

前置：Node 22、pnpm 10、Docker（Compose v2）。

```bash
cp .env.example .env.local          # 默认值可直接使用（请把 BETTER_AUTH_SECRET / CRON_SECRET 换成随机串）
pnpm install
docker compose up -d                # PostgreSQL 16（宿主机端口 5433；可用 POSTGRES_PORT 覆盖）
pnpm db:migrate && pnpm db:seed     # 建表 + 写入 28 类目 / 150 商品 / 640 SKU / 2 账号 / 4 地址 / 3 历史订单
pnpm dev                            # http://localhost:3000
```

演示账号（seed 写入，仅本地演示）：

| 角色   | 邮箱               | 密码          |
| ------ | ------------------ | ------------- |
| 买家   | `demo@shop.local`  | `Demo123456`  |
| 管理员 | `admin@shop.local` | `Admin123456` |

登录页 `/login` 提供两个「一键演示登录」按钮。

## 常用命令

| 命令                                                                      | 说明                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start`                                  | 开发 / 生产构建 / 生产启动                                                     |
| `pnpm lint` / `pnpm typecheck`                                            | ESLint / `next typegen && tsc --noEmit`                                        |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | 生成迁移 / 迁移 / 写入 seed / 清库重建                                         |
| `pnpm test:unit`                                                          | Vitest（`tests/unit` 直连 `shop_test`，`tests/component` jsdom），含覆盖率阈值 |
| `pnpm test:e2e`                                                           | Playwright chromium（自动起 dev server；setup 阶段重置 seed）                  |
| `pnpm test`                                                               | unit + e2e                                                                     |

## 目录

```text
src/app/(shop)     买家页    src/app/(admin)/admin  后台    src/app/api  Route Handlers
src/server/db      Drizzle schema / client       src/server/services  业务 service（唯一写入口）
src/server/auth    Better Auth 实例与守卫         src/components       UI（shadcn）与业务组件
scripts/seed       seed 脚本与中文商品 JSON       tests/{unit,component,e2e}  测试
drizzle/           migrations（仅由 drizzle-kit 生成）   docs/{plan,adr,research,screenshots}
```

## 里程碑状态

| 里程碑           | 状态                             |
| ---------------- | -------------------------------- |
| M1 骨架与数据    | ✅                               |
| M2 商品目录      | ⏳                               |
| M3 交易闭环      | ⏳                               |
| M4 后台与验收    | ⏳                               |
| M5 AI 导购（P1） | 未启动（需满足 BRIEF §8.2 门槛） |

> 本 README 会在 M4 补齐：CI 徽章、截图、3–5 分钟关键流程录屏、购物车角标口径等。
