# AGENTS.md

This file provides guidance to opencode when working with code in this repository.

## Commands

There is no test runner configured in this repo.

Database schema changes are applied with versioned migrations:

```bash
npm run db:generate  # Generate migration files from schema changes
npm run db:migrate   # Apply migrations + seed
npm run db:push      # Direct schema sync (alternative, no versioned files)
```

`DATABASE_URL` (MySQL connection string) must be set for the app, seeds, or drizzle-kit to connect. Currently points to Railway.

## Architecture

Next.js 16 App Router app, fullstack, no separate backend. Each feature (`bank-accounts`, `transactions`, `categories`) follows the same four-layer structure, split across two top-level trees:

- `app/<feature>/` — routes and UI
  - `page.tsx`, nested route folders (e.g. `new-account/`, `[name]/`, `transaction-detail/`) for the actual pages
  - `_components/` — feature-scoped client components (forms, tables, cards, actions menus); not routable due to the `_` prefix
  - `schema/index.ts` — Zod schema used to validate form submissions for that feature
- `server/<feature>/` — server-only code, outside the `app/` tree
  - `actions.ts` — `"use server"` Server Actions (create/update/delete), each following the same shape: parse `FormData` into `rawFields` → `schema.safeParse` → on failure return `{ success: false, error: {...}, fields: rawFields }` via `z.treeifyError` → on success `db.insert/update/delete` → `revalidatePath` → return `{ success: true, message, fields }`
  - `queries.ts` — read-only Drizzle queries, each wrapped in try/catch returning a `{ success, data, error }` shape (never throws to the caller)
- `types/<feature>.types.ts` — shared TS interfaces/types for that feature (list items, action state, form fields/errors), imported by both the `app/` and `server/` sides
- `server/dashboard/queries.ts` — cross-feature aggregate queries (net balance, monthly income/expense, funds distribution, daily average) built with raw `sql` template fragments via Drizzle, used by the dashboard/home page

Forms follow the same client-side pattern: a `"use client"` component wraps a `<form action={formAction}>` driven by `useActionState`, dispatching straight to the imported server action, and uses `useEffect` on the resulting state to fire `sonner` toasts and redirect via `next/navigation`'s `router`. Validation errors from the server action populate `FieldError` (from `components/ui/field.tsx`) per field; `state?.fields` is used to repopulate inputs after a failed submit.

Pages that need to branch behavior on mobile vs desktop (e.g. `transactions/page.tsx` switching between a `TransactionsTable` and `TransactionsCard`) detect this server-side via `next/headers` `headers()` + `next/server` `userAgent()`, not client-side media queries.

### Database (Drizzle + MySQL)

- Single schema file: `db/schema/schema.ts`. Tables: `users`, `bankAccounts`, `transactions`, `categories`. A shared `timestamps` helper adds `updatedAt`/`createdAt`/`deletedAt` (soft-delete columns exist but soft-delete filtering is not implemented everywhere — check queries before assuming `deletedAt` is honored).
- `db/index.ts` creates a single pooled `mysql2` connection and a `drizzle()` instance, cached on `globalThis` in non-production to survive HMR — always import `db` from `@/db`, don't create new connections.
- Migrations live in `drizzle/`, config in `drizzle.config.ts` (schema path, output dir, `mysql` dialect).
- There is no auth yet: `userId` is hardcoded to `1` rather than derived from a session, in:
  - `server/bank-accounts/actions.ts` (`createBankAccount`, `updateBankAccount`)
  - `app/transactions/_components/FormTransaction.tsx` (hidden `userId` input defaulting to `"1"`)
  - `app/page.tsx` (dashboard calls to `getMonthlyFinancials`, `getNetBalance`, `getDailyAverage`, `getFundsDistribution`)
  - When real auth is added, all of these need to switch to a real session-derived `userId`, and `transactions` queries/actions (which currently take `userId` as a form field, not a hardcoded constant — see `transactionSchema`) should also be revisited to make sure the value can't be spoofed from the client.
