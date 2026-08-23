---
paths:
  - 'tests/**'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
---

# 测试规则（tests/**）

- `tests/unit/**`：Vitest，直连 `DATABASE_URL_TEST`（`shop_test`）；每个文件 `beforeEach` 调 `resetDb()`（truncate 业务表）+ 用 `tests/factories.ts` 造最小数据；**不要**依赖 seed 数据；文件间串行执行。
- `tests/component/**`：Vitest + jsdom + Testing Library，只测纯展示/交互组件，不连库。
- `tests/e2e/**`：Playwright chromium，对 `pnpm dev` + 完整 seed 运行；用 `tests/e2e/fixtures.ts` 的登录 helper（买家 / 管理员）；用 `data-testid` 选择器；涉及库存/订单变更的用例在 `afterAll` 恢复数据或使用专用商品。
- 命名：文件名与 `docs/plan/03-P0完成标准与测试矩阵.md` 的「文件」列完全一致；`it()` 描述用中文、一条用例只断言一个行为。
- 覆盖率：`src/server/services/**` 语句覆盖 ≥ 80%（`pnpm test:unit` 自动统计并阈值拦截）。
- 并发用例（`inventory.concurrency.test.ts`）必须用真实连接池并发调用 service，不 mock。
