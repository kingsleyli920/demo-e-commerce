# TEST_REPORT — P0（M1–M4）测试报告

> 生成时间：2026-08-23 13:20（本地）。所有命令均在本机实际运行，退出码 0。测试矩阵定义见 [`docs/plan/03-P0完成标准与测试矩阵.md`](docs/plan/03-P0完成标准与测试矩阵.md)，逐条验收见 [`ACCEPTANCE_MATRIX.md`](ACCEPTANCE_MATRIX.md)。

## 1. 总览

| 命令                           | 结果                            | 说明                                                                                               |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`                    | ✅ 0 error / 0 warning          | ESLint 9（next/core-web-vitals + ts）                                                              |
| `pnpm typecheck`               | ✅                              | `next typegen && tsc --noEmit`（strict）                                                           |
| `pnpm test:unit`               | ✅ **103/103**（20 文件，~13s） | Vitest 4：node 项目直连 `shop_test`（文件串行 + 每文件 resetDb + factories），jsdom 项目跑组件测试 |
| `pnpm test:e2e`                | ✅ **47/47**（12 文件，~32s）   | Playwright chromium，对 `pnpm dev` + 完整 seed；setup 先重置 seed 并保存买家/管理员会话            |
| `pnpm build`                   | ✅                              | Next 16 production build（Turbopack），全部路由动态渲染                                            |
| `pnpm demo:record`             | ✅                              | 3 分 05 秒关键流程录屏 + 12 张截图 → `docs/screenshots/`                                           |
| CI（.github/workflows/ci.yml） | ⏸ 已就绪未实跑                  | 仓库暂无 GitHub remote；工作流通过 actionlint 校验，步骤与本地命令一一对应                         |

## 2. 覆盖率（`pnpm test:unit`，@vitest/coverage-v8，阈值 80/70/80/80）

范围：`src/server/services/**`、`src/server/dto/**`、`src/lib/**`（UI 不计覆盖率，走 E2E）。

| 指标       | 覆盖率                |
| ---------- | --------------------- |
| Statements | **96.54%**（475/492） |
| Branches   | **88.41%**（351/397） |
| Functions  | **98.30%**（116/118） |
| Lines      | **97.57%**（403/413） |

> 满足用户要求「≥80%，尽量 ≥85%」。剩余未覆盖分支为并发兜底路径（如事务冲突重读、购物车并发建车重查）。

## 3. 单元 / 集成测试（103 条 = node 102 + 组件 1）

| 文件                              | 用例数 | 覆盖点                                                                                                                           |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`                    | 5      | requireUser 401 / requireAdmin 403 / isAdmin                                                                                     |
| `lib.test.ts`                     | 9      | spec-key 排序稳定 / 金额格式化 / 运费边界 9899/9900 / 订单号格式 / AppError                                                      |
| `catalog.search.test.ts`          | 7      | 关键词（标题/品牌/副标题、大小写）、父含子类目、价格区间边界与反转、4 种排序、分页越界、下架隐藏、组合条件                       |
| `catalog.category.test.ts`        | 2      | 类目树 sort 顺序 / slug / 面包屑                                                                                                 |
| `catalog.sku.test.ts`             | 3      | resolveSku 顺序无关 / 不存在组合 null / availableOptions 置灰（下架、缺失组合、售罄可选）                                        |
| `catalog.stockHint.test.ts`       | 2      | 可售=stock−locked（不为负）/ >5 / 1–5 / 0 三档文案                                                                               |
| `catalog.home.test.ts`            | 3      | 首页类目树 / 热销排序 / listProductsByIds                                                                                        |
| `cart.test.ts`                    | 14     | 加购合并 / 钳制 min(可售,99) / 下架售罄拒绝 / 50 条上限 / 角标口径 / 列表分区 / 数量 / 删除 / 全选 / 失效不可勾选 / 价格变动标记 |
| `address.test.ts`                 | 5      | CRUD / 默认唯一 / 删除默认不提升 / 越权 404                                                                                      |
| `checkout.preview.test.ts`        | 5      | 运费边界 / 只计勾选 / 失效拒绝 / 空车拒绝 / buyNow 校验与默认地址                                                                |
| `order.place.test.ts`             | 5      | 建单快照/过期时间/订单号/INIT 支付单/移车/锁库存/日志 / 服务端价格权威 / 不足整单回滚无残留 / 立即购买不动购物车 / 他人地址拒绝  |
| `inventory.test.ts`               | 4      | 锁定 / 多 SKU 回滚 / 支付扣减与取消释放（日志序列断言）/ 可售不为负                                                              |
| `inventory.concurrency.test.ts`   | 1      | **50 并发同 SKU（库存 10）→ 恰 10 成功 / 40 库存不足；stock=10,locked=10 → 全部支付后 0/0；lock/deduct 日志各 10 条**            |
| `payment.mock.test.ts`            | 6      | 成功扣减 / 失败可重试 / 同 transaction_no 幂等 / 已 PAID 幂等 / 已取消 400 / 不存在 404                                          |
| `order.expire.test.ts`            | 5      | 详情/列表惰性取消并释放 / 未过期不动 / 批量数量 / cron 端点 401 与计数                                                           |
| `order.stateMachine.test.ts`      | 4      | 合法迁移 / 7 种非法迁移抛错 / 时间戳字段 / 终态无出边                                                                            |
| `order.query.test.ts`             | 6      | Tab 计数与倒序 / 取消收货发货约束 / 快照不受改价影响 / 越权 null                                                                 |
| `admin.test.ts`                   | 6      | 上下架 / SKU 编辑（admin_adjust 日志 + min_price 派生）/ 库存≥locked / 发货约束 / 统计计算 / 列表筛选                            |
| `dto-and-helpers.test.ts`         | 12     | safe-next（open redirect 变体）/ DTO 解析容错 / sku 纯函数 / getDefaultAddress / admin 详情 / 非法输入分支                       |
| `component/product-card.test.tsx` | 1      | 商品卡渲染与链接（jsdom + Testing Library）                                                                                      |

## 4. E2E（Playwright，47 条，对应矩阵 8 主路径 + 3 守卫 + full-journey）

| spec                          | 条数 | 关键断言                                                                                                                         |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| `auth.setup.ts`（setup）      | 3    | 重置 seed；买家/管理员登录并保存 storageState                                                                                    |
| `auth.spec.ts`                | 7    | 一键登录显示昵称 / 密码错误提示与回填 / 受保护页 302+next / 登录回跳 / 退出 / 买家进 /admin 403（HTTP 403）/ 管理员进入后台      |
| `browse-search.spec.ts`       | 8    | 首页 ≥12 卡与两级类目 / 搜索均含关键词 / 类目含子类目（总数断言）/ 价格升序 / 价格区间 / 翻页 URL+内容 / 空态清除筛选 / 下架 404 |
| `pdp-sku.spec.ts`             | 6    | 未选满禁用+价格区间 / 切规格价格变化+低库存 / 缺失与下架组合置灰 / 售罄禁购 / 未登录加购跳登录回跳 / 加购 toast+角标+步进钳制    |
| `cart-ops.spec.ts`            | 5    | 同 SKU 合并 / 超库存钳制提示 / 勾选合计变化 / 删除 / 后台下架→失效分区不可勾选不计合计                                           |
| `checkout-pay.spec.ts`        | 1    | 无地址→新增→回跳→提交→倒计时→支付成功→待发货→前台库存减少（仅剩 2→1 件）                                                         |
| `checkout-fail-retry.spec.ts` | 1    | 支付失败停留可重试 → 订单列表「去支付」→ 成功                                                                                    |
| `order-lifecycle.spec.ts`     | 3    | 待付款取消（库存释放）/ 发货→待收货→确认收货→已完成 / 改价后旧订单快照金额不变                                                   |
| `stock-guard.spec.ts`         | 2    | 库存改 1：A 锁定成功（stock=1,locked=1）；B 售罄禁购 + 直连结算被服务端拒绝                                                      |
| `admin-guard.spec.ts`         | 2    | 买家访问 /admin 三个路径均 HTTP 403；未登录 302                                                                                  |
| `admin-flow.spec.ts`          | 6    | 后台 UI：搜索→改库存 1→前台仅剩 1 件；下架→前台 404→恢复；PAID 筛选→发货→前台待收货；统计卡与超时按钮                            |
| `full-journey.spec.ts`        | 3    | 首页→搜索→详情→加购→结算→支付→后台发货→确认收货→已完成（含购物车清空断言）                                                       |

> M3 阶段「后台操作」步骤（改库存/下架/发货）曾以 DB/服务等价模拟（`tests/e2e/db-helper.ts`，有注释声明）；M4 的 `admin-flow.spec.ts` 已用真实后台 UI 复测同类操作。

## 5. 性能口径（docs/plan/03 P0-9）

- `pnpm test:unit` ≈ 13s（< 60s ✅）
- `pnpm test:e2e` ≈ 32s（< 5min ✅）

## 6. 已知限制

- CI 未在 GitHub Actions 实跑（无 remote）；本地按 CI 相同顺序执行全部步骤通过。
- E2E 与 `db:seed` 会重置**开发库**（README 已标注）。
