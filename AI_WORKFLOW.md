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
**提交范围**：`57176dc..chore(m1)`（脚手架 → Claude 配置 → schema → seed → test 红 → auth 绿 → 首页/占位 → auth E2E → CI → docs → 验收）

### M2 商品目录

**目标与范围**：P0-2 搜索/类目/筛选/排序/分页 + P0-3 详情/SKU 选择/库存提示/加购/立即购买（BRIEF §8 M2 DoD）。
**时间**：开始 2026-08-23 01:26 ｜ 结束 2026-08-23 12:23（其间 01:35–12:16 因 Claude 会话限额暂停，不计耗时）｜ 净耗时 ≈0.5h ｜ 预算 5h ｜ 偏差 −4.5h

**关键 Prompt**

| #   | 时间  | Prompt（原话/忠实摘要）                                                                                         | 意图                      | 结果评价                  |
| --- | ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- |
| 1   | 01:26 | （AI 自主，按 03 测试矩阵）先写 catalog.search/category/sku/stockHint + cart 加购全部单测（红），再实现 service | TDD                       | 采纳；17+8 条单测一次成形 |
| 2   | 12:16 | 用户「继续」（会话限额恢复后）                                                                                  | 恢复执行                  | 继续 M2                   |
| 3   | 12:18 | （AI 自决）把 availableOptions/priceRange/stockHint 等纯函数抽到 src/lib，service re-export                     | 客户端组件复用且不打包 pg | 采纳                      |

**模型选择**：主线程 claude-fable-5（同 M1，无子代理）。

**实际使用的 Skills / Plugins / MCP**：无新增（沿用 M1 基础设施）。

**人工决策**

| 决策                 | 备选                        | 选择与理由                                                                       | 影响范围               |
| -------------------- | --------------------------- | -------------------------------------------------------------------------------- | ---------------------- |
| E2E 固定商品 fixture | 每次动态查找 / 固定 seed id | **固定 id（1019/1093 等）+ 注释**：seed 数据已提交进仓库、确定性强，测试更稳更快 | tests/e2e              |
| 搜索价格区间 min>max | 报错 / 自动交换             | **自动交换**（宽容输入）                                                         | catalog.searchProducts |

**失败与恢复**

| 现象                                                                | 根因                              | 恢复方式                                               | 损失时长             | 预防措施                           |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------ | -------------------- | ---------------------------------- |
| 子代理 code-reviewer 首跑中断                                       | Claude 会话限额（resets 3:50am）  | 主线程按清单自查后继续；M2/M3 合并重跑独立审查（见下） | ~0                   | 审查安排在里程碑边界、避开限额高峰 |
| 主会话 01:35–12:16 暂停                                             | 同上（会话限额）                  | 恢复后从失败测试现场继续                               | 挂钟 10.7h，净损失 0 | —                                  |
| catalog.search 一条用例断言写错（min/max 反转区间预期含 99 元商品） | 测试预期笔误（99 不在 [100,300]） | 修正预期为 259 元商品                                  | 2 分钟               | —                                  |
| `next build` 因 e2e 文件 readonly storageState 类型报错             | `as const` 过窄                   | 显式 `{ cookies: never[]; origins: never[] }`          | 1 分钟               | —                                  |
| **流程疏漏：M2 通过后未提交 `chore(m2)` 直接进入 M3**               | 里程碑收尾清单执行不严            | 补录 `chore(m2)`（本提交），并在此如实记录             | —                    | chore(mN) 加入里程碑收尾自查清单   |

**人工介入统计**：纠偏 0 ｜ 否决 0 ｜ 补充信息 0 ｜ 手工修改 0 ｜ 环境处理 0 ｜ **合计 0**（「继续」为恢复指令，不计介入）

**测试结果**

```text
pnpm test:unit  → 40/40（M2 时点；catalog.search 7 / category 2 / sku 3 / stockHint 2 / cart 8 …）
pnpm test:e2e   → 24/24（auth 10 + browse-search 8 + pdp-sku 6）
pnpm lint / typecheck / build → 绿
覆盖率（services+lib+dto）：Stmts 88.5% · Branch 84.1% · Funcs 80.4% · Lines 91.4%
```

**验收**：docs/plan/03 P0-2 全部 7 条验收项 ☑；P0-3 全部 6 条 ☑（逐条对照 e2e/单测）
**超预算规则是否触发**：否
**提交范围**：`a454e44..fec7409`（test 红 → service 绿 → UI → e2e）+ 补录验收提交

### M3 交易闭环

**目标与范围**：P0-4 库存（并发不超卖）+ P0-5 购物车 + P0-6 Mock Checkout（地址/结算/下单/支付/超时）+ P0-7 订单（BRIEF §8 M3 DoD）。
**时间**：开始 2026-08-23 12:23 ｜ 结束 2026-08-23 12:50 ｜ 净耗时 ≈0.9h（含审查修复）｜ 预算 9h ｜ 偏差 −8.1h

**关键 Prompt**

| #   | 时间  | Prompt（原话/忠实摘要）                                                                                                 | 意图                          | 结果评价                                                        |
| --- | ----- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| 1   | 12:24 | （AI 自主）按 03 矩阵一次写全 9 个单测文件（地址/购物车/预览/下单/库存/并发/支付/超时/状态机/查询），再统一实现 service | TDD 批量红→绿                 | 采纳；实现后 86/86 一次全绿（含 50 并发）                       |
| 2   | 12:26 | （AI→子代理）重跑独立审查（M1+M2 已提交全量 diff）                                                                      | 里程碑边界质量闸              | 产出 High 1 / Medium 2 / Low 8，全部当场修复（fix(m3) 56a49e6） |
| 3   | 12:38 | （AI 自决）「后台操作」类 E2E 步骤（改库存/下架/发货）M3 用 db-helper/服务等价模拟，M4 admin-flow 用真实后台 UI 复测    | 后台 UI 属 M4，避免里程碑倒挂 | 采纳，已在测试注释与提交说明中声明                              |

**模型选择**：主线程 claude-fable-5；独立审查子代理 claude-fable-5（继承）。

**实际使用的 Skills / Plugins / MCP**

| 名称                                                                        | 用途                | 是否有效（1–5）与备注                                                             |
| --------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| code-reviewer（general-purpose 子代理加载 .claude/agents/code-reviewer.md） | M1+M2 独立审查      | 5：抓到真 High（open redirect \\ 绕过）与 addToCart 并发丢增量、guard 正则误/漏拦 |
| pg（tests/e2e/db-helper）                                                   | E2E 前置/清理直连库 | 4                                                                                 |

**人工决策**（AI 自决，记录备查）

| 决策           | 备选                                | 选择与理由                                                            | 影响范围      |
| -------------- | ----------------------------------- | --------------------------------------------------------------------- | ------------- |
| addToCart 并发 | 读-判-写 / FOR UPDATE / 原子 upsert | **onConflictDoUpdate + least()**：单语句原子合并，无锁等待            | cart service  |
| 支付单模型     | 每次尝试一行 / 单行覆盖             | **INIT 行复用 + 失败标记 FAILED、重试补建**：支付历史可追溯且幂等简单 | payments      |
| 超时实现       | 定时任务 / 惰性 + 手动              | **读取时惰性取消 + cron 端点 + 后台按钮**（按 BRIEF §6.6）            | order service |
| E2E 后台步骤   | 等 M4 / DB 模拟                     | **M3 DB/服务模拟 + M4 UI 复测**（见关键 Prompt 3）                    | tests/e2e     |
| 状态机并发     | 读后写 / 条件更新                   | **UPDATE … WHERE status = 原状态**，0 行 → CONFLICT                   | order service |

**失败与恢复**

| 现象                                                                         | 根因                                                    | 恢复方式                                                    | 损失时长 | 预防措施                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | -------- | --------------------------------------- |
| 审查发现 open redirect 可用 /\\host 绕过（High）                             | 只挡了 //，未挡反斜杠变体                               | 统一 safeNextPath（拒绝 // 与含 \\ 路径），三处调用点收敛   | 5 分钟   | 写入 lib + 单点复用                     |
| 审查发现 addToCart 并发丢增量/唯一冲突 500（Medium）                         | read committed 下读-判-写交错                           | 改 onConflictDoUpdate 原子 upsert；新增 clampReason         | 8 分钟   | 记入 server.md 意识（并发写用原子语句） |
| 审查发现 guard-bash 误拦 rm -f error.log、漏拦 rm -rf a b 复合命令（Medium） | 单正则整串匹配                                          | 重写为分段解析 + rm flags/目标白名单校验，17 条回归用例验证 | 10 分钟  | 守卫脚本自带回归清单                    |
| lint 报 react-hooks/set-state-in-effect（address 弹窗）                      | useActionState+useEffect 关闭弹窗模式触发 React 19 规则 | 改为直接 await server action + startTransition 回调里收尾   | 5 分钟   | 记入 ui.md 思路                         |

**人工介入统计**：纠偏 0 ｜ 否决 0 ｜ 补充信息 0 ｜ 手工修改 0 ｜ 环境处理 0 ｜ **合计 0**

**测试结果**

```text
pnpm test:unit  → 87/87（18 文件）
  覆盖率（services+lib+dto）：Stmts 89.7% · Branch 81.0% · Funcs 88.8% · Lines 92.0%（阈值 80/70/80/80）
pnpm test:e2e   → 36/36（setup 3 + auth 7 + browse-search 8 + pdp-sku 6 + cart-ops 5 + checkout-pay 1 + checkout-fail-retry 1 + order-lifecycle 3 + stock-guard 2）
并发不超卖输出：50 并发 → fulfilled 10 / rejected 40（全部「库存不足」）→ stock=10, locked=10 → 全部支付后 stock=0, locked=0；lock 日志 10 条、deduct 10 条
pnpm lint / typecheck / build → 绿
```

**验收**：docs/plan/03 P0-4（5 条）/ P0-5（7 条）/ P0-6（8 条）/ P0-7（6 条）全部 ☑（其中「后台改库存/发货」的 UI 路径在 M4 admin-flow 复测）
**超预算规则是否触发**：否
**提交范围**：`ddf60c2..chore(m3)`（test 红 → service 绿 → 审查修复 → UI → e2e）

### M4 后台与验收

**目标与范围**：P0-8 最小后台 + P0-9 完整测试/CI + P0-10 留痕收尾（README/录屏/截图/验收文档/独立 Review/tag）。
**时间**：开始 2026-08-23 12:43 ｜ 结束 2026-08-23 13:50（含终审修复 fix(m4)）｜ 净耗时 ≈1.9h ｜ 预算 5h ｜ 偏差 −3.1h

**关键 Prompt**

| #   | 时间  | Prompt（原话/忠实摘要）                                                                                                           | 意图              | 结果评价                                           |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| 1   | 12:43 | （AI 自主）admin service TDD：统计/上下架/SKU 编辑（库存≥locked + admin_adjust 日志 + min_price 派生）/发货约束/列表筛选          | 后台核心          | 6/6 一次绿                                         |
| 2   | 12:47 | （AI 自决，采纳上轮审查 Low 建议）后台每个 page 与每个 Server Action 独立 requireAdmin，不依赖 layout                             | 防越权窗口        | 采纳                                               |
| 3   | 12:55 | （AI 自主）覆盖率补测：把 Branch 从 79.8% 拉到 88.4%（safe-next/DTO/纯函数/admin 详情/非法输入分支）                              | 用户「尽量 85%+」 | Stmts 96.5 / Branch 88.4 / Funcs 98.3 / Lines 97.6 |
| 4   | 12:58 | （AI 自主）Playwright 录屏方案：单窗口全程叙事 + file:// 打开仓库内速览页（git log + 总览表 + 并发测试数据），slowMo+停留控制时长 | 3–5 分钟录屏交付  | 3 分 05 秒（185s），4 次迭代后达标                 |

**模型选择**：主线程 claude-fable-5；终审子代理 claude-fable-5（继承）。

**实际使用的 Skills / Plugins / MCP**

| 名称                             | 用途                       | 是否有效（1–5）与备注               |
| -------------------------------- | -------------------------- | ----------------------------------- |
| Playwright（video + screenshot） | 3 分 05 秒录屏 + 12 张截图 | 5：脚本化可重录（pnpm demo:record） |
| ffprobe（本机已有）              | 校验录屏时长               | 4                                   |
| code-reviewer 子代理             | P0 终审（增量重点）        | 见 §3                               |

**人工决策**（AI 自决，记录备查）

| 决策               | 备选                                   | 选择与理由                                                                             | 影响范围   |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| 已支付 GMV 口径    | 今日 / 累计                            | **累计**（卡片标注「累计」），今日订单数单独一卡                                       | admin 统计 |
| 售罄 SKU 口径      | stock=0 / 可售≤0                       | **上架且可售 ≤0**（与前台「已售罄」一致）                                              | admin 统计 |
| 录屏并发演示       | 双窗口同录（两段视频）/ 单窗口顺序叙事 | **单窗口**：A 锁定库存后 B 账号同窗被拒 + 速览页展示 50 并发测试数据；保证单一视频文件 | tests/demo |
| GMV/库存等演示数据 | 录屏前清库 / 直接用当日累计            | 录屏脚本先 db:seed 重置，保证可复现                                                    | demo 脚本  |

**失败与恢复**

| 现象                                                 | 根因                                                                                   | 恢复方式                                   | 损失时长                          | 预防措施                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------- | ------------------------ |
| 录屏第 1 次卡死 10 分钟超时                          | demo 配置未设 actionTimeout，点击不存在的图集缩略图无限等待                            | 设 actionTimeout=15s + 先 isVisible 再点击 | 10 分钟（后台跑，未阻塞其它工作） | demo config 固定超时     |
| 录屏第 2 次失败：并发段 B 找不到提交按钮             | B 在结算**预览**阶段就被服务端拒绝（页面显示「库存不足」而非表单）——行为正确，断言写错 | 断言改为 checkout-error 文案               | 3 分钟                            | —                        |
| 录屏第 3 次失败：/admin 页 logout 找不到前台头部菜单 | 后台布局是独立退出按钮                                                                 | logout 助手先回首页                        | 2 分钟                            | —                        |
| 录屏时长 51s → 2m49s → 不足 3 分钟                   | 停留时间估算偏短                                                                       | 两轮加长关键停留                           | 8 分钟                            | ffprobe 校验时长纳入流程 |

**人工介入统计**：纠偏 0 ｜ 否决 0 ｜ 补充信息 0 ｜ 手工修改 0 ｜ 环境处理 0 ｜ **合计 0**

**测试结果**

```text
pnpm lint / typecheck → 绿
pnpm test:unit  → 103/103（20 文件，≈13s）；覆盖率 Stmts 96.54% · Branch 88.41% · Funcs 98.30% · Lines 97.57%
pnpm test:e2e   → 47/47（12 文件，≈32s；含 admin-flow 后台 UI 复测 M3 模拟过的后台操作）
pnpm build      → 绿；pnpm demo:record → 3 分 05 秒录屏 + 12 截图
```

**验收**：docs/plan/03 P0-8（4 条）/ P0-9（4 条）/ P0-10（6 条）全部 ☑（逐条证据见 ACCEPTANCE_MATRIX.md）；README 可从干净环境启动（命令逐条核验）
**超预算规则是否触发**：否
**提交范围**：`7f10ee4..chore(m4)`（admin test 红 → service 绿 → 后台 UI → e2e → 覆盖率补测 → 录屏与文档 → 验收）

**附：3–5 分钟录屏路径与内容**：`docs/screenshots/demo-p0-key-flows.webm`（185s）——主路径（登录→搜索→SKU→购物车→结算→支付→订单）+ 库存护栏（后台改库存 1 → A 锁定 → B 被拒）+ 后台发货/确认收货 + 30 秒提交历史与 AI_WORKFLOW 速览。README 验收清单勾选见 ACCEPTANCE_MATRIX.md。

## 3. 独立 Review 记录（P0 完成后、Final PR 前）

共两轮（均为只读 code-reviewer 子代理，按 `.claude/agents/code-reviewer.md` 角色执行）：

### 第 1 轮（M3 开始前 · 对象：dev 相对 main 的 M1+M2 全部提交）

| 项          | 内容                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 时间 / 耗时 | 2026-08-23 12:26–12:37（≈11 分钟；首次启动于 01:31 因会话限额中断）                                                                              |
| 发现        | Critical 0 ｜ High 1 ｜ Medium 2 ｜ Low 8                                                                                                        |
| High        | login `safeNext` 可被 `/\host` 反斜杠变体绕过（open redirect）→ 统一 `safeNextPath`                                                              |
| Medium      | addToCart 读-判-写并发丢增量/唯一冲突 500 → 原子 upsert；guard-bash 正则误拦（`rm -f error.log`）/漏拦（复合命令）→ 分段解析重写 + 17 条回归用例 |
| 复验        | ☑ 全部修复于 56a49e6，lint/typecheck/unit/e2e 复跑绿                                                                                             |

### 第 2 轮（P0 终审 · 对象：56a49e6..HEAD 增量 + 全量红线复核）

| 项              | 内容                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 时间 / 耗时     | 2026-08-23 13:26–13:35（≈9 分钟）                                                                                                                                                                                              |
| 发现            | **Critical 0 ｜ High 0** ｜ Medium 2 ｜ Low 9                                                                                                                                                                                  |
| Medium          | ① 验收文档在 tag/chore(m4) 落地前的超前声明（事实性）→ 措辞修正并按流程补齐；② /api/pay/mock 无鉴权/归属校验（BRIEF 定位为开放 Mock、不部署公网，故未评 High）→ 已加登录 + 本人订单校验                                        |
| Low（全部修复） | placeOrder 加锁顺序防死锁；payment 幂等两处边界（transaction_no 全局查 + 过期取消移出主事务）；updateSku 条件更新；checkout 死代码；admin 订单分页链接；地址 action 错误处理统一；admin-flow afterAll 恢复；TEST_REPORT 用例数 |
| 审查确认通过项  | 四条红线全量核验、库存原子锁定与流水、状态机条件更新、全部查询带 userId 越权过滤、admin 页面+action 全 requireAdmin、SQL 全参数化、金额口径、E2E 隔离与文档数字                                                                |
| 复验命令与结果  | `pnpm lint`/`typecheck` 绿；`pnpm test` → unit 103/103 + e2e 47/47（fix(m4) 提交）                                                                                                                                             |
| 结论            | ☑ 允许 Final PR ｜ ☑ 满足 M5 门槛第 2 条（无 Critical/High）                                                                                                                                                                   |

## 4. M5 启动门槛检查

| 条件                                                  | 结果                                              |
| ----------------------------------------------------- | ------------------------------------------------- |
| M1–M4 全部验收通过（03 全勾选，`pnpm test` 与 CI 绿） | ☐                                                 |
| 独立 Review 无 Critical/High（见第 3 节）             | ☐                                                 |
| 累计用时 ≤ 24h 且剩余 ≥ 6h（总览表）                  | ☐ 累计 <h> ｜ 剩余 <h>                            |
| **决定**                                              | ☐ 启动 M5 ｜ ☐ 不启动（P1 仅保留设计），原因：<…> |

## 5. 汇总与复盘（Final PR 前填写）

- **总耗时 vs 预算**：P0 净耗时 ≈3.9h / 24h（M1 0.65 + M2 ≈0.5 + M3 ≈0.9 + M4 ≈1.9，M4 含终审修复）；P1 未启动 0/6h。挂钟时间跨 01:00–13:50，其中 01:35–12:16 为 Claude 会话限额暂停。
- **人工介入合计 0**（纠偏/否决/补充信息/手工修改/环境处理均为 0；用户仅在会话限额恢复后发送「继续」，不计介入）。
- **最有效的工具**：① Workflow 多子代理编排（5 路 API 版本调研 + 6 路 seed 生成并行，直接避免 Better Auth `account.issuer`、Vitest 4 projects、Next 16 `proxy.ts`/force-dynamic 等至少 4 个会翻车的点）；② code-reviewer 只读子代理（两轮审查抓到 open redirect `/\` 绕过、addToCart 并发丢增量、guard 正则误/漏拦等真问题）。**最无效/代价最高**：录屏时长控制的试错（4 次迭代，主要是停留时长估算）。
- **失败与恢复中最值得沉淀的 3 条**（已分别落实）：① 训练记忆与当前版本 API 的偏差必须在写码前用 node_modules/.d.ts + context7 实测消除（写入 CLAUDE.md）；② 并发写一律用单语句原子操作（onConflictDoUpdate / 条件 UPDATE ... WHERE status=旧值），不要读-判-写（写入 server.md 意识）；③ 守卫类脚本必须带回归用例清单（guard-bash.sh 17 条自测）。
- **如果重来会改变的 3 个做法**：① M2 收尾时先跑「里程碑收尾自查清单」（chore(mN) 提交这次漏做补录）；② 录屏第一版就用 ffprobe 校验时长并按目标时长反推停留；③ 独立 Review 固定安排在里程碑边界的后台时段（首轮因会话限额中断浪费了一次启动）。
- **Final PR**：材料就绪（docs/FINAL_PR.md）；仓库暂无 GitHub remote，建仓/推送为对外操作待用户确认后执行 `gh pr create --base main --head dev --body-file docs/FINAL_PR.md`。
- **录屏路径**：docs/screenshots/demo-p0-key-flows.webm（3 分 05 秒）｜ **tag**：p0-done（chore(m4) 后打）。
