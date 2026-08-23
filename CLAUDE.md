# CLAUDE.md — AI 电商 Demo（P0 收敛版）

> 接手入口：`IMPLEMENTATION_BRIEF.md`（唯一真源）→ `docs/plan/03-P0完成标准与测试矩阵.md`（验收）→ `AI_WORKFLOW.md`（随做随记）。`docs/research/**` 仅背景，不要重新调研。范围只做 P0（M1–M4）；M5 需满足 BRIEF §8.2 门槛。

## 常用命令

```bash
docker compose up -d            # Postgres 16（宿主机端口 5433，可用 POSTGRES_PORT 覆盖）
pnpm db:generate                # schema.ts → drizzle/ migration（不手改 migrations）
pnpm db:migrate                 # 迁移 DATABASE_URL
pnpm db:seed                    # 写入 seed（类目/商品/SKU/账号/地址/历史订单）
pnpm db:reset                   # drop schema + migrate + seed
pnpm dev                        # http://localhost:3000
pnpm lint && pnpm typecheck
pnpm test:unit                  # Vitest：tests/unit + tests/component（自动迁移 shop_test，带覆盖率阈值）
pnpm test:e2e                   # Playwright chromium：tests/e2e（自动起 dev server）
pnpm test                       # unit + e2e
pnpm build && pnpm start
```

演示账号：买家 `demo@shop.local / Demo123456`；管理员 `admin@shop.local / Admin123456`。

## 目录约定

```text
src/app/(shop)/…        买家页：/ /search /c/[slug] /p/[id] /cart /checkout /pay/[orderNo] /orders /orders/[orderNo] /account/addresses /login
src/app/(admin)/admin/… 后台：/admin /admin/products /admin/products/[id] /admin/orders /admin/orders/[orderNo]
src/app/api/…           auth/[...all]（Better Auth）、pay/mock、cron/expire-orders
src/components/ui/      shadcn 组件；src/components/<domain>/ 业务组件
src/server/db/          schema.ts、client.ts           src/server/dto/  zod 输入输出
src/server/services/    catalog cart checkout order payment inventory address admin auth
src/server/auth/        better-auth 实例与 requireUser/requireAdmin 守卫
src/lib/                纯工具（formatPrice、spec-key…）
scripts/seed/           seed.ts + data/{categories,products}.zh.json
tests/unit tests/component tests/e2e tests/factories.ts
drizzle/                migrations（只由 drizzle-kit 生成）
```

## 四条红线（违反即返工）

1. `src/server/services/**` 只依赖 `db` + `dto` + drizzle/zod，**不 import** `next/*`、React、AI SDK。
2. 所有写操作走 service（事务内）；页面与 Server Actions 只做校验与调用。
3. 金额全程整数「分」，展示层再 `/100`。
4. 不手改 `drizzle/` migrations；改 `schema.ts` 后 `pnpm db:generate`。

## 关键业务规则速查（完整见 BRIEF §6）

- 可售 = `stock - locked_stock`；锁定用条件原子 UPDATE，0 行 → 「库存不足: <sku>」整单回滚；每步写 `inventory_logs`。
- 运费：合计 ≥ 9900 分免运费，否则 1000 分。订单号 `ORD + yyyyMMddHHmmss + 4 随机`。
- 状态机：PENDING_PAYMENT → PAID → SHIPPED → COMPLETED；PENDING_PAYMENT → CANCELLED；其余抛错并写时间戳。
- Mock 支付幂等：同 transactionNo / 已 PAID → 成功不重复扣；CANCELLED → 400。
- 超时：读取时惰性取消 + `POST /api/cron/expire-orders`（`x-cron-secret`）+ 后台按钮。
- 购物车：同 SKU 合并；1 ≤ qty ≤ min(可售, 99)；≤ 50 条；失效项不可勾选不计合计。
- 鉴权：`/cart /checkout /orders /account/*` 需登录；`/admin/*` 需 role=admin；订单只能看本人（他人 → 404）。

## 工作方式

- 单一 `dev` 分支；Conventional Commits + 里程碑 scope（`feat(m2):` `test(m3):` `docs(m1):` `chore(mN):`）；service 功能**先 `test(mN):` 提交（红）再 `feat(mN):` 提交（绿）**；每条提交末尾 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 每个里程碑：实现 → 测试 → 修复 → `code-reviewer` subagent 审查 → 更新 `AI_WORKFLOW.md`（+ 必要 ADR）→ `chore(mN): milestone N 验收通过（测试 X/Y，耗时 Zh）`。
- 写代码前对不确定的 API 用 context7 或 `node_modules/next/dist/docs/**` 核对；Next 16 与训练记忆有差异（`proxy.ts`、`params` 为 Promise、默认动态渲染）。
- 不新增依赖清单外的库（需要时先在 AI_WORKFLOW 写理由）；不装非必要 Plugins/MCP；不连生产资源；不做 P1/P2。
- 失败处理：读真实错误 → 根因假设 → 聚焦修改 → 重测；同一问题 3 个方案仍失败 → 记 `BLOCKERS.md`，继续其它 P0。

## Hooks / 子代理

- `.claude/settings.json`：PreToolUse(Bash) `guard-bash.sh` 拦 `rm -rf`（安全目录除外）/ `drizzle-kit drop` / `git push --force` / `reset --hard` / docker 删卷 / 非测试库 TRUNCATE；PostToolUse(Edit|Write) `format-file.sh` 跑 prettier。
- `.claude/agents/code-reviewer.md`：只读审查员；`.claude/rules/{server,ui,tests}.md` 按路径自动生效。
