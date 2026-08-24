---
paths:
  - 'src/server/**'
---

# Server 层规则（src/server/**）

- `src/server/services/**` **只能** import：`@/server/db/*`、`@/server/dto/*`、`@/server/errors`、`@/lib/*`（纯函数）、`drizzle-orm*`、`zod`、Node 内置模块；**禁止** import `next/*`、`react`、`@/app/*`、`@/components/*`、AI SDK。
- 所有写操作（加购 / 下单 / 支付 / 取消 / 发货 / 库存调整）必须在 service 中完成，并在一个 `db.transaction` 内保证原子性；页面与 Server Actions 只做参数校验（zod）与调用。
- 金额字段一律为整数「分」（`integer`），不得出现浮点；展示层再 `/100`。
- 库存：可售 = `stock - locked_stock`；锁定必须用条件原子更新 `UPDATE skus SET locked_stock = locked_stock + :q WHERE id = :id AND stock - locked_stock >= :q`，影响行数为 0 视为「库存不足」并整单回滚；每次变动写 `inventory_logs`。
- 订单状态迁移只能通过 `order` service 的状态机函数，非法迁移必须抛错；每次迁移写对应时间戳。
- 业务错误统一抛 `src/server/errors.ts` 中的 `AppError`（带 `code`、HTTP 状态），不要抛裸字符串。
- Schema 变更：只改 `src/server/db/schema.ts`，然后 `pnpm db:generate`；**不手改** `drizzle/` 下的 migration。
- 测试：service 的每个公开函数在 `tests/unit/**` 有对应用例；新增 service 功能先写 `test(mN):` 提交再 `feat(mN):` 提交。
