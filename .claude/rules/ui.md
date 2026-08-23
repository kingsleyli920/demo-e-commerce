---
paths:
  - 'src/app/**'
  - 'src/components/**'
---

# UI 层规则（src/app/**、src/components/**）

- 默认 Server Component；仅在需要交互（表单状态、toast、选择器）时加 `'use client'`，并把客户端组件收敛到叶子。
- 数据读取在 Server Component / Server Action 中通过 `@/server/services/*` 完成；**禁止**在页面里直接写 SQL 或直接 import `@/server/db/client`。
- 写操作：`src/app/**/actions.ts`（`'use server'`）→ zod 校验 → 调 service → `revalidatePath` / `redirect`；捕获 `AppError` 转成用户可读中文提示。
- UI 文案中文；金额展示用 `formatPrice(fen)`（`src/lib/format.ts`），不要手写 `/100`。
- 组件优先用 `src/components/ui/*`（shadcn）；业务组件放 `src/components/<domain>/`。
- 关键交互元素加稳定的 `data-testid`（E2E 依赖），命名 `kebab-case`，例如 `data-testid="add-to-cart"`。
- 鉴权：受保护页面在 Server Component 顶部 `await requireUser()` / `requireAdmin()`（`@/server/auth/guards`），不要只依赖客户端判断。
- 图片：`next/image` + `cdn.dummyjson.com` remotePattern；列表图固定尺寸避免 CLS。
