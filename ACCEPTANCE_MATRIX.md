# ACCEPTANCE_MATRIX — P0 验收清单（对照 docs/plan/03）

> 状态：**M1–M4 全部 PASS**（2026-08-23）。每条验收项给出证据：单测（`tests/unit/…`）/ E2E（`tests/e2e/…`）/ 人工核验。测试运行结果见 [`TEST_REPORT.md`](TEST_REPORT.md)。

## 测试基础设施（P0-9 前置）

| 项                                       | 状态                            | 证据                                                                                                                        |
| ---------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 测试库 `shop_test`，test:unit 前自动迁移 | ✅                              | `tests/global-setup.ts`（drizzle migrate）；docker 初始化脚本自动建库                                                       |
| 数据工厂                                 | ✅                              | `tests/factories.ts`：createUser / createCategory / createProductWithSkus / createAddress（下单场景由 placeOrder 直接覆盖） |
| 脚本齐全                                 | ✅                              | package.json：test:unit / test:e2e / test / lint / typecheck                                                                |
| CI 工作流                                | ✅（未实跑，见 TEST_REPORT §6） | `.github/workflows/ci.yml`：postgres:16 service → install → lint → typecheck → migrate → unit(coverage) → build → e2e       |
| service 层覆盖 ≥ 80%                     | ✅ Stmts 96.5%                  | coverage-summary（TEST_REPORT §2）                                                                                          |

## P0-1 账号

| #    | 验收项                                                                    | 状态 | 证据                                                                              |
| ---- | ------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| 1    | /login 表单 + 两个一键演示登录                                            | ✅   | e2e auth.spec「一键演示登录」「邮箱密码登录」                                     |
| 2    | 登录显示昵称/退出；退出后受保护页跳 /login?next=                          | ✅   | e2e auth.spec「退出后访问 /orders 被重定向」                                      |
| 3    | 未登录 /cart /checkout /orders /account/* → 302；非管理员 /admin → 403 页 | ✅   | e2e auth.spec + admin-guard.spec（断言 HTTP 302/403）                             |
| 4    | 密码非明文（Better Auth scrypt）；账号写在 README                         | ✅   | account.password 为 scrypt 哈希（seed 后人工核验 161 字符串）；README「演示账号」 |
| unit | requireUser 401 / requireAdmin 403                                        | ✅   | unit auth.test.ts                                                                 |

## P0-2 商品目录与搜索

| #   | 验收项                                                                | 状态 | 证据                                                             |
| --- | --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| 1   | 首页 2 级类目 + ≥12 商品卡                                            | ✅   | e2e browse-search「首页渲染」                                    |
| 2   | /search?q= ILIKE 标题/品牌/副标题，大小写不敏感；空关键词返回全部上架 | ✅   | unit catalog.search「关键词匹配」「空关键词」                    |
| 3   | 类目含子类目；价格区间按 min_price（元→分）                           | ✅   | unit「父类目包含子类目」「价格区间边界」；e2e「价格区间过滤」    |
| 4   | 4 种排序 + 综合默认；切换保持条件                                     | ✅   | unit「4 种排序」；e2e「价格升序保持关键词」                      |
| 5   | 分页 20/页、总数、越界空页                                            | ✅   | unit「分页」；e2e「翻到第 2 页」                                 |
| 6   | 下架商品不出现在列表/搜索/详情（404）                                 | ✅   | unit「下架不返回」；e2e「下架 404」+ admin-flow「下架→前台 404」 |
| 7   | 空态 +「清除筛选」                                                    | ✅   | e2e「无结果空态」                                                |

## P0-3 商品详情与 SKU

| #   | 验收项                                                  | 状态 | 证据                                                  |
| --- | ------------------------------------------------------- | ---- | ----------------------------------------------------- |
| 1   | 图集切换/标题/副标题/品牌/面包屑/描述                   | ✅   | e2e pdp-sku「详情页渲染」                             |
| 2   | 规格选择器；选满定位 SKU；未选满显示区间+「请选择规格」 | ✅   | unit catalog.sku（resolveSku）；e2e「未选满禁用」     |
| 3   | SKU 价格/原价/库存三档提示；售罄禁购                    | ✅   | unit catalog.stockHint；e2e「低库存提示」「售罄禁购」 |
| 4   | 不存在/下架组合置灰                                     | ✅   | unit availableOptions；e2e「组合置灰」                |
| 5   | 加购 toast + 角标；立即购买进入单 SKU 结算              | ✅   | e2e「加购 toast 角标」；checkout-pay（buyNow 链路）   |
| 6   | 未登录加购/立即购买 → 登录后回跳                        | ✅   | e2e「未登录加购跳登录并回跳」                         |

## P0-4 库存

| #   | 验收项                                             | 状态 | 证据                                                                           |
| --- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| 1   | stock / locked_stock 分离；可售=差值               | ✅   | schema check 约束 + unit stockHint                                             |
| 2   | 条件原子锁定；任一不足整单回滚并指明 SKU           | ✅   | unit inventory「多 SKU 回滚」（报错含商品名+规格）、order.place「无残留」      |
| 3   | 支付扣减 / 取消超时释放                            | ✅   | unit inventory「支付扣减/取消释放」、order.expire                              |
| 4   | inventory_logs 全量流水                            | ✅   | unit inventory（日志序列 lock/deduct/unlock 断言）、admin.test（admin_adjust） |
| 5   | 并发：50 单抢 10 库存恰 10 成功，支付后 0/0 无负数 | ✅   | unit inventory.concurrency（输出见 TEST_REPORT §3）；e2e stock-guard           |

## P0-5 购物车

| #   | 验收项                                | 状态 | 证据                                                                |
| --- | ------------------------------------- | ---- | ------------------------------------------------------------------- |
| 1   | 同 SKU 合并；(cart_id, sku_id) 唯一   | ✅   | unit cart「合并」+ schema 唯一索引 + 原子 upsert；e2e cart-ops      |
| 2   | 1 ≤ qty ≤ min(可售, 99)，超限钳制提示 | ✅   | unit「钳制」；e2e「超库存钳制提示」                                 |
| 3   | 删除/勾选/全选；合计只计已勾选有效项  | ✅   | unit「勾选/全选/合计」；e2e「取消勾选合计变化」「删除行」           |
| 4   | 失效分区、不可勾选、不计合计、可删除  | ✅   | unit「失效项」；e2e「后台下架→失效」                                |
| 5   | 实时价 + 价格变动提示                 | ✅   | unit「价格变动标记」（行内 badge 展示加购价）                       |
| 6   | 条目 >50 拒绝                         | ✅   | unit「50 条上限」                                                   |
| 7   | 角标口径写进 README                   | ✅   | README「购物车角标口径」=有效条目数量之和；unit「失效条目不计角标」 |

## P0-6 Mock Checkout

| #   | 验收项                                                 | 状态 | 证据                                                        |
| --- | ------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| 1   | 地址 CRUD/默认唯一/静态省市区/至少一个地址才能结算     | ✅   | unit address；e2e checkout-pay「无地址→新增→回跳」          |
| 2   | 服务端结算预览（合计/运费边界/应付）；失效项拒绝       | ✅   | unit checkout.preview（9899/9900 边界）                     |
| 3   | 提交订单：二次校验+锁库存+快照+INIT+清购物车→ /pay     | ✅   | unit order.place；e2e checkout-pay                          |
| 4   | 订单号 ORD+时间戳+4 随机；channel=web                  | ✅   | unit order.place（正则断言 + channel）                      |
| 5   | 支付页倒计时 + 成功/失败按钮及流转                     | ✅   | e2e checkout-pay / checkout-fail-retry                      |
| 6   | 回调幂等（重复 transaction_no / 已 PAID / 已取消 400） | ✅   | unit payment.mock（4 条幂等/拒绝用例）                      |
| 7   | 超时惰性取消 + cron 端点（secret）+ 后台按钮           | ✅   | unit order.expire（含 401）；e2e admin-flow「处理超时订单」 |
| 8   | 立即购买同流程不动购物车                               | ✅   | unit order.place「立即购买」                                |

## P0-7 订单

| #   | 验收项                                    | 状态 | 证据                                                       |
| --- | ----------------------------------------- | ---- | ---------------------------------------------------------- |
| 1   | 6 Tab 计数正确、倒序                      | ✅   | unit order.query；e2e order-lifecycle                      |
| 2   | 详情：状态时间线/快照/金额/按状态操作按钮 | ✅   | e2e checkout-pay + order-lifecycle（页面断言）             |
| 3   | 取消仅待付款并释放库存；其它状态拒绝      | ✅   | unit order.query「取消」；e2e「待付款取消」                |
| 4   | 确认收货仅已发货                          | ✅   | unit order.query「确认收货」                               |
| 5   | 历史订单不受改价/下架影响（快照）         | ✅   | unit「快照」；e2e「改价后金额不变」                        |
| 6   | 只能查看本人订单（他人 404）              | ✅   | unit order.query「越权 null」（页面 404 由 notFound 渲染） |

## P0-8 最小后台

| #   | 验收项                                                                      | 状态 | 证据                                                                       |
| --- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| 1   | /admin 仅管理员；统计卡 4 项                                                | ✅   | e2e admin-guard + admin-flow「统计卡」；unit admin「统计数值」             |
| 2   | 商品列表（分页/搜索）+ 上下架 + SKU 编辑（库存≥locked）                     | ✅   | unit admin；e2e admin-flow「改库存/下架」                                  |
| 3   | 订单列表（状态筛选）+ 详情 + 模拟发货（仅 PAID，可填承运商/单号）+ 超时按钮 | ✅   | unit admin/order.query「发货」；e2e admin-flow                             |
| 4   | 变更写日志/时间戳并即时反映前台                                             | ✅   | unit admin（admin_adjust）；e2e admin-flow（前台仅剩 1 件 / 404 / 待收货） |

## P0-9 完整测试 + CI

| #   | 验收项                                   | 状态                                         | 证据                                                      |
| --- | ---------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | pnpm test 一键通过；unit <60s；e2e <5min | ✅                                           | TEST_REPORT §1/§5（13s / 32s）                            |
| 2   | CI 在 dev push 与 PR 运行 + README 徽章  | ✅ 工作流与徽章就绪 / ⏸ 待推送 GitHub 后实跑 | ci.yml + README 徽章与说明                                |
| 3   | 并发不超卖/支付幂等/状态机测试存在且通过 | ✅                                           | inventory.concurrency / payment.mock / order.stateMachine |
| 4   | service 覆盖率 ≥80%（CI 输出）           | ✅ 96.5%（阈值挂在 test:unit，CI 同命令）    | TEST_REPORT §2                                            |

## P0-10 AI 协作留痕

| #   | 验收项                                                                                          | 状态                                                                          | 证据                                                            |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | 单一 dev 分支；Conventional Commits + scope；chore(mN) 验收提交；test 先于 feat；Co-Authored-By | ✅                                                                            | `git log --oneline`（M2 验收提交为补录并已在 AI_WORKFLOW 说明） |
| 2   | AI_WORKFLOW.md 逐里程碑随做随记                                                                 | ✅                                                                            | AI_WORKFLOW.md M1–M4 段 + 总览表                                |
| 3   | ADR×3                                                                                           | ✅                                                                            | docs/adr/0001–0003                                              |
| 4   | CLAUDE.md + rules + 双 hooks + code-reviewer                                                    | ✅                                                                            | CLAUDE.md（67 行）/.claude/**                                   |
| 5   | 独立 Review 无 Critical/High 遗留；tag p0-done；Final PR                                        | ✅ Review 完成并复验 / tag 已打 / PR 材料就绪（待建 remote，见 FINAL_REPORT） | AI_WORKFLOW §3；docs/FINAL_PR.md                                |
| 6   | 3–5 分钟录屏 + 截图                                                                             | ✅ 3 分 05 秒                                                                 | docs/screenshots/demo-p0-key-flows.webm + 12 张截图             |
