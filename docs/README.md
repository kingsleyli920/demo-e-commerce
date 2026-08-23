# demo-e-commerce · 文档索引

> 以「展示 + AI 协作开发过程」为主的电商 Demo：**P0 ≈ 24h、10 分钟可完整演示**，核心电商闭环（商品/SKU/库存/购物车/Mock 结算支付/订单/最小后台）+ 完整测试不缩水。本目录与根目录 `IMPLEMENTATION_BRIEF.md` 是项目的唯一事实源。

## 开发接手入口

| 文档 | 用途 |
|---|---|
| [`../IMPLEMENTATION_BRIEF.md`](../IMPLEMENTATION_BRIEF.md) | **新 Session 从这里开始**：范围、已拍板决策、技术栈、数据模型、业务规则、路由、里程碑 DoD、超预算规则、M5 门槛、工作方式（单 `dev` 分支 + Final PR）、起手步骤 |
| [`../AI_WORKFLOW.md`](../AI_WORKFLOW.md) | 人机协作记录模板：逐里程碑记录关键 Prompt、模型选择、Skills/Plugins、人工决策、失败恢复、人工介入次数、耗时、测试结果；独立 Review 与 M5 门槛检查 |

## 规划（docs/plan）

| 文档 | 内容 | 状态 |
|---|---|---|
| [01-MVP落地规划](plan/01-MVP落地规划.md) | P0 / P1 / 不做；10 分钟演示脚本 + 3–5 分钟录屏；决策记录（已拍板）；M1–M4（P0）+ M5（P1）里程碑与 DoD；超预算规则；M5 启动门槛；业务规则速查；风险 | v1.1 收敛版 |
| [02-第一天安装清单](plan/02-第一天安装清单.md) | Claude Code 插件/MCP、脚手架与依赖、env 与 scripts 约定、Claude Code 项目配置 | v1.1 收敛版 |
| [03-P0完成标准与测试矩阵](plan/03-P0完成标准与测试矩阵.md) | 每个 P0 功能的验收标准 + 单测/E2E 用例 + 测试基础设施与 CI 要求 | v1.0 |
| [archive/01-MVP落地规划-v0.2-扩展版](plan/archive/01-MVP落地规划-v0.2-扩展版.md) | 4–5 周扩展范围版（AI 导购 P0、对外 MCP、12 个决策点），仅作历史对照 | 已归档 |

## 调研（docs/research，背景材料，不必通读）

| 文档 | 内容 |
|---|---|
| [01-电商平台功能与用例调研](research/01-电商平台功能与用例调研.md) | 主流平台买家旅程与卖家侧能力（P0/P1/P2）、AI 购物能力与 Agentic Commerce 协议、最小电商定义、数据模型与坑 |
| [02-提效工具与skills调研](research/02-提效工具与skills调研.md) | 开发 / 设计 / 测试 / AI 工具链 / 协作五板块，含核实过的安装命令 |
| [03-技术栈与开源参考调研](research/03-技术栈与开源参考调研.md) | 开源电商盘点、AI-native 参考、假数据源、技术栈对比与版本表、AI 架构、部署、仓库结构 |

## 约定

- 调研文档只记录事实与来源；决策在 `plan/` 与 `IMPLEMENTATION_BRIEF.md` 中体现，开发开始后写入 `adr/`；过程记录写 `AI_WORKFLOW.md`。
- Git：单一 `dev` 分支按里程碑分组提交，P0 完成后独立 Review → Final PR 到 `main`。
- 版本号、价格、平台功能随时可能变化，落地前以官方文档为准。
