# AI_WORKFLOW — 人机协作记录

> 目的：作为「我如何与 AI 协作完成开发」的**主证据**，逐里程碑记录关键 Prompt、模型选择、实际使用的 Skills/Plugins/MCP、人工决策、失败与恢复、人工介入次数、耗时与测试结果。
> 填写规则：① **随做随记，不得事后补写**（每个里程碑开始时先填开始时间，结束时填齐并随 `chore(mN)` 提交一起入库）；② Prompt 记原话或忠实摘要，不美化；③ 失败也要记（这正是展示重点）；④ 数字可核（耗时、介入次数、测试通过数）。
> 状态：模板 v1.0（2026-08-22）。开发开始后，把各节 `<…>` 占位替换为实际内容；未发生的项写「无」。

---

## 0. 总览（每个里程碑结束时更新一行）

| 里程碑           | 开始             | 结束             | 净耗时 | 预算 | 人工介入次数 | 主模型                           | 测试（通过/总数）      | 验收状态           |
| ---------------- | ---------------- | ---------------- | ------ | ---- | ------------ | -------------------------------- | ---------------------- | ------------------ |
| M1 骨架与数据    | 2026-08-23 01:01 | 2026-08-23 01:40 | 0.65h  | 5h   | 0            | claude-fable-5 (ultracode/xhigh) | unit 21/21 · e2e 10/10 | ☑                  |
| M2 商品目录      |                  |                  |        | 5h   |              |                                  |                        | ☐                  |
| M3 交易闭环      |                  |                  |        | 9h   |              |                                  |                        | ☐                  |
| M4 后台与验收    |                  |                  |        | 5h   |              |                                  |                        | ☐                  |
| P0 合计          |                  |                  | <h>    | 24h  | <n>          |                                  |                        | ☐                  |
| M5 AI 导购（P1） |                  |                  |        | 6h   |              |                                  |                        | ☐ / 未启动（原因） |

**人工介入的定义与类型**（计数口径，全程统一）：

- `纠偏`：AI 的方案/实现偏离文档或预期，由人指出并要求修改；
- `否决`：人拒绝 AI 的提议（含拒绝引入依赖、拒绝扩大范围）；
- `补充信息`：AI 因信息不足停下提问，人提供后继续；
- `手工修改`：人直接编辑代码/配置而非通过 AI；
- `环境处理`：人处理 AI 无法完成的环境/权限/账号问题。
  （纯粹的「同意/继续」不计为介入。）

---

## 1. 固定信息（M1 开始时填写，后续有变更追加）

| 项             | 内容                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 开发工具       | Claude Code 2.1.241；主模型 claude-fable-5（Workflow 子代理继承同模型）；effort ultracode（xhigh + 动态 Workflow 编排）；bypass permissions 无人值守                                                                                                                                   |
| 启用的 Plugins | 无新增（用户要求不装非必要 Plugins；`docs/plan/02` 列的 typescript-lsp / security-guidance / commit-commands / frontend-design 均未安装，用 `pnpm typecheck` + hooks + 本仓库 rules 替代）                                                                                             |
| 启用的 MCP     | context7（调研子代理核对 Next 16 / Better Auth / Drizzle / Vitest / Playwright / shadcn 当前 API）；shadcn MCP 未初始化（CLI 足够）；playwright / github / claude-in-chrome 在 M1 未用到（E2E 用 `@playwright/test` CLI）                                                              |
| 启用的 Skills  | Workflow 工具（多子代理编排：5 路只读调研、6 路 seed 数据生成）；`code-reviewer` 只读 subagent（里程碑验收前）；`/code-review` 计划在 P0 完成后独立 Review 使用                                                                                                                        |
| 项目配置       | `CLAUDE.md` 67 行；`.claude/rules/{server,ui,tests}.md`；hooks：PostToolUse(Edit\|Write) prettier 格式化、PreToolUse(Bash) `guard-bash.sh` 拦 `rm -rf`/`drizzle-kit drop`/`git push --force`/`reset --hard`/docker 删卷/非测试库 TRUNCATE；subagent：`.claude/agents/code-reviewer.md` |
| 参考文档       | `IMPLEMENTATION_BRIEF.md` v1.1、`docs/plan/01` v1.1、`docs/plan/03` v1.0                                                                                                                                                                                                               |

---

## 2. 里程碑记录（每个里程碑复制本模板填写）

### M1 骨架与数据

**目标与范围**：脚手架 + Docker Postgres + Drizzle schema/migration + seed（≥80 SPU/≥200 SKU）+ Better Auth 登录/登出 + 首页从 DB 渲染 + 测试基础设施 + CI 骨架 + CLAUDE.md/rules/hooks/code-reviewer + ADR×3（BRIEF §8 M1 DoD）。
**时间**：开始 2026-08-23 01:01 ｜ 结束 2026-08-23 01:40 ｜ 净耗时 ≈0.65h ｜ 预算 5h ｜ 偏差 −4.3h（并行子代理承担调研与数据生成，主线程只做集成与验证）

**关键 Prompt**（按时间顺序，只记影响走向的 3–8 条）

| #   | 时间  | Prompt（原话/忠实摘要）                                                                                                                                                                                                                                                                 | 意图                         | 结果评价（采纳/部分采纳/否决）                                                                           |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | 01:00 | 用户开场：「把根目录 IMPLEMENTATION_BRIEF.md 作为唯一接手入口…先完成接手和开发前检查（Git/Node/Docker/env/Playwright/命令/无人值守认证/范围 M1–M4）…没有硬阻塞就记录 M1 开始时间直接开始 M1」+ 测试分层偏好（UT/FT ≥80–85%，E2E/Playwright 功能全覆盖）+ `/goal` 连续自主执行到 P0 完成 | 接手 + Preflight + 自主闭环  | 采纳；Preflight 全部通过后 01:01 开始 M1                                                                 |
| 2   | 01:06 | （AI→子代理）Workflow `api-cheatsheets`：5 个只读调研 agent 各产出「写代码前必知」速查表（Next 16 / Better Auth 1.7 / Drizzle 0.45 / shadcn 4.19 / Vitest 4 + Playwright 1.62），要求对照 node_modules 实际 .d.ts 与 context7                                                           | 消除训练记忆与当前版本的偏差 | 采纳；直接避免了 4 处会翻车的点（`account.issuer` 必填、`proxy.ts`、Vitest 4 projects、`force-dynamic`） |
| 3   | 01:08 | （AI→子代理）Workflow `seed-data-gen`：按 6 个一级类目并行生成中文商品/SKU JSON，附 `validate.mjs` 强校验（数量、低库存比例、规格组合唯一、图片只能来自 DummyJSON 骨架、耳机演示数据），agent 自行跑校验直至 OK                                                                         | 生成可提交的 seed 数据       | 采纳；6/6 一次通过校验，合并为 150 SPU / 640 SKU                                                         |
| 4   | 01:21 | （AI 自决）typedRoutes 造成跨里程碑类型阻塞 → 关闭 typedRoutes                                                                                                                                                                                                                          | 降低增量开发摩擦             | 采纳并记入 ADR-0002                                                                                      |

**模型选择**

| 任务                     | 模型 / effort              | 选择原因                            | 事后评价                                                        |
| ------------------------ | -------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| 主线程集成/调试/提交     | claude-fable-5 / ultracode | 会话默认                            | 合适                                                            |
| 5 路 API 调研子代理      | claude-fable-5（继承）     | 需要读大量 .d.ts 并实测，准确性优先 | 产出质量高（含实测 tsc/运行验证），耗时约 20 分钟，未阻塞主线程 |
| 6 路 seed 数据生成子代理 | claude-fable-5（继承）     | 中文文案质量 + 严格 JSON 约束       | 一次通过校验；每路 ~30 SPU 约 9 分钟                            |

**实际使用的 Skills / Plugins / MCP**

| 名称                           | 用途                                                                         | 是否有效（1–5）与备注                                                |
| ------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Workflow（多子代理编排）       | 调研 + 数据生成并行化                                                        | 5：主线程同时完成脚手架/schema/配置，整体 M1 0.65h                   |
| context7 MCP（子代理内）       | 核对 Next 16 / Better Auth / Drizzle / Vitest / Playwright / shadcn 当前 API | 4：配合 node_modules .d.ts 实测最可靠                                |
| shadcn CLI 4.19                | `init -y -b radix -p nova` + `add -y …` 20 个组件                            | 4：非交互需显式 `-p` 预设；会擅自把 Google 字体加回 layout（已去掉） |
| @playwright/test CLI           | E2E（auth 10 条）                                                            | 5                                                                    |
| actionlint（本地 docker 镜像） | 校验 CI YAML                                                                 | 4                                                                    |
| `.claude/hooks/guard-bash.sh`  | 拦截危险命令                                                                 | 本里程碑未触发拦截（按设计）                                         |

**人工决策**（含小决策：文档未覆盖时选了什么、为什么）

| 决策                                               | 备选                                                      | 选择与理由                                                                                                                         | 影响范围                                    |
| -------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Postgres 宿主机端口                                | 5432（文档默认）/ 停掉本机 brew postgresql@17 / 改用 5433 | **5433**（`POSTGRES_PORT` 可覆盖）：本机 5432 被 Homebrew postgresql@17 常驻占用 14 天，停掉属于用户环境的不可逆干预               | docker-compose / .env.example / README / CI |
| 是否安装 docs/plan/02 的 4 个 Plugins + shadcn MCP | 装 / 不装                                                 | **不装**：用户明确「不安装非必要 Plugins/Skills/MCP」；用 typecheck/hooks/rules 覆盖同等目的                                       | 开发工具层                                  |
| `dotenv` 依赖                                      | `node --env-file` / dotenv                                | **dotenv**：drizzle.config / vitest / playwright / 脚本都需在 Next 之外加载 `.env.local`，dotenv 是 drizzle-kit 文档做法           | devDependencies                             |
| typedRoutes                                        | 开 / 关                                                   | **关**：路由逐里程碑创建，开着会让占位期 typecheck 持续红                                                                          | next.config                                 |
| 字体                                               | Google Geist（模板/shadcn 默认）/ 系统字体                | **系统字体栈**：离线可构建、中文友好                                                                                               | layout / globals.css                        |
| seed 规模                                          | 80 SPU / 200 SKU（下限）                                  | **150 SPU / 640 SKU**（6 一级 / 22 叶子）：给搜索/筛选/分页测试足够样本                                                            | seed JSON                                   |
| 鉴权守卫实现                                       | proxy.ts / 页面级 二选一                                  | **页面级 `requireUser/requireAdmin` 为准 + proxy.ts 乐观 302**：proxy 只看 cookie 不查库，满足「302 到登录」验收；真正鉴权在服务端 | src/proxy.ts、guards.ts                     |
| 数据库 `rating`                                    | integer×10 / real                                         | **real**                                                                                                                           | schema                                      |
| Git 远程                                           | 立即建 GitHub 仓库并推送 / 仅本地                         | **仅本地**：仓库无 remote；建库推送是对外操作，待用户决定（gh 已登录 kingsleyli920）                                               | CI 实跑 / Final PR                          |

**失败与恢复**

| 现象                                                                                         | 根因                                                   | 恢复方式                                                                    | 损失时长 | 预防措施（是否写入 CLAUDE.md/rules/hooks）                           |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `pnpm db:migrate`：`Top-level await is currently not supported with the "cjs" output format` | package.json 无 `"type":"module"`，tsx 以 CJS 转译脚本 | 脚本改为 `main().catch()` 包装                                              | 2 分钟   | 脚本统一 main() 模式（已在 scripts/db、seed 中执行）                 |
| `pnpm db:migrate` 只读到 `.env`，`.env.local` 未注入                                         | drizzle-kit 自带 dotenv 只读 cwd/.env                  | `drizzle.config.ts` 与脚本显式 `dotenv.config({ path: '.env.local' })`      | 1 分钟   | 记入 ADR-0002                                                        |
| Better Auth signUp 可能失败：schema 缺 `account.issuer`                                      | 1.7 新增必填列（训练记忆里没有）                       | 调研子代理实测发现 → schema 加列 + 唯一索引 → 首提交前重生成 init migration | 5 分钟   | 已写入 schema 注释；「写代码前用 context7/.d.ts 核对」写入 CLAUDE.md |
| 首页/登录 500：`A "use server" file can only export async functions, found object`           | actions.ts 导出了常量 `DEMO_ACCOUNTS`                  | 常量移到 `src/lib/demo-accounts.ts`                                         | 2 分钟   | 写入 ui.md 规则意识（actions 文件只放 async 函数）                   |
| typedRoutes 关闭后 typecheck 仍报 `RouteImpl`                                                | `.next/types/link.d.ts` 残留                           | `rm -r .next && next typegen`                                               | 2 分钟   | —                                                                    |
| E2E「错误密码→正确密码」失败：重填后仍停留登录页                                             | React 19 表单 action 完成后重置非受控输入，邮箱被清空  | action 返回 `email`，输入框 `defaultValue={state?.email}`                   | 3 分钟   | 记入 ui.md 思路（表单错误态需回填）                                  |
| `next build` 失败：Playwright `STORAGE_STATE.anonymous as const` 为 readonly                 | 类型过窄                                               | 改为显式 `{ cookies: never[]; origins: never[] }`                           | 1 分钟   | —                                                                    |
| shadcn `init -y` 仍弹预设交互；并擅自把 Google 字体加回 layout                               | CLI 4.19 必须 `-p <preset>`；"Updating fonts" 步骤     | 加 `-p nova`（radix）；重写 layout 用系统字体                               | 3 分钟   | 记入 AI_WORKFLOW（本表）                                             |

**人工介入统计**：纠偏 0 ｜ 否决 0 ｜ 补充信息 0 ｜ 手工修改 0 ｜ 环境处理 0 ｜ **合计 0**（Docker Desktop 未运行由 AI `open -a Docker` 自行拉起）

**测试结果**

```text
pnpm lint       → 0 问题
pnpm typecheck  → 通过（next typegen && tsc --noEmit）
pnpm test:unit  → 21/21（5 文件：auth / lib / catalog.home / cart / component product-card）
                  覆盖率（src/server/services + src/lib + src/server/dto）：Stmts 93.9% · Branch 89.1% · Funcs 100% · Lines 94.1%（阈值 80/70/80/80）
pnpm test:e2e   → 10/10（setup 3：重置 seed / 买家登录 / 管理员登录；auth.spec 7）
pnpm build      → 成功，全部路由 ƒ (Dynamic)
CI              → .github/workflows/ci.yml 已写并通过 actionlint；仓库无 remote，未实跑（待用户决定是否建 GitHub 仓库）
```

**验收**：BRIEF §8 M1 DoD：`docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` 可跑 ☑ ｜ `/` 从 DB 渲染 20 商品卡 + 类目入口 ☑ ｜ 登录/登出（表单 + 一键演示）☑ ｜ CI 骨架（lint/typecheck/unit/build/e2e）☑（本地等价执行）｜ CLAUDE.md/rules/hooks/code-reviewer ☑ ｜ ADR×3 ☑ ｜ `docs/plan/03` P0-1 账号 4 条验收项 ☑（受保护页 302、`/admin` 403、密码由 Better Auth scrypt 哈希、README 有账号）
**超预算规则是否触发**：否（0.65h / 5h）
**提交范围**：见 `git log --oneline` M1 段（`chore(m1)` 提交后回填）

### M2 商品目录

<复制 M1 模板>

### M3 交易闭环

<复制 M1 模板；并发不超卖测试的输出必须贴在「测试结果」>

### M4 后台与验收

<复制 M1 模板；附 3–5 分钟录屏路径与 README 验收清单勾选情况>

---

## 3. 独立 Review 记录（P0 完成后、Final PR 前）

| 项          | 内容                                                                                 |
| ----------- | ------------------------------------------------------------------------------------ |
| 方式        | `/code-review <level>` 或 `code-reviewer` subagent；对象：`dev` 相对 `main` 全部变更 |
| 时间 / 耗时 |                                                                                      |
| 发现        | Critical <n> ｜ High <n> ｜ Medium <n> ｜ Low <n>（逐条：文件:行、问题、处理）       |
| 复验        | Critical/High 全部修复并复验：☐ ｜ 复验命令与结果                                    |
| 结论        | ☐ 允许 Final PR ｜ ☐ 允许进入 M5（还需 §4 其余两条）                                 |

## 4. M5 启动门槛检查

| 条件                                                  | 结果                                              |
| ----------------------------------------------------- | ------------------------------------------------- |
| M1–M4 全部验收通过（03 全勾选，`pnpm test` 与 CI 绿） | ☐                                                 |
| 独立 Review 无 Critical/High（见第 3 节）             | ☐                                                 |
| 累计用时 ≤ 24h 且剩余 ≥ 6h（总览表）                  | ☐ 累计 <h> ｜ 剩余 <h>                            |
| **决定**                                              | ☐ 启动 M5 ｜ ☐ 不启动（P1 仅保留设计），原因：<…> |

## 5. 汇总与复盘（Final PR 前填写）

- 总耗时 vs 预算：P0 <h>/24h；P1 <h>/6h。
- 人工介入合计 <n>（按类型分布）；最常见的纠偏原因 Top 3。
- 最有效 / 最无效的 Skills、Plugins、MCP 各 1–2 个及原因。
- 失败与恢复里最值得写进 CLAUDE.md/rules/hooks 的 3 条。
- 如果重来一次会改变的 3 个做法。
- Final PR 链接 ｜ 录屏路径 ｜ tag。
