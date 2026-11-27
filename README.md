# 💰 Personal Finance Tracker

A modern, high-performance, and responsive Fullstack web application designed to help users take full control of their personal finances. Built with Next.js and TypeScript, this platform allows users to seamlessly track income, monitor daily expenses, and gain valuable insights into their spending habits through interactive data visualization driven by shadcn/ui charts.

🌐 **Live Demo:** [https://finance-tracking-visualizator.vercel.app/](https://finance-tracking-visualizator.vercel.app/)

---

## ✨ Core Features

- **📊 Interactive Financial Dashboard:** Real-time overview of net balance, monthly income and expenses, funds distribution, daily average spending and expenses broken down by category.
- **💸 Transaction Management:** Full CRUD with filtering and pagination, built on Next.js **Server Actions** instead of traditional API routes.
- **📥 Bulk Import with AI-Assisted Categorization:** Upload bank statements as **CSV, Excel or PDF**, preview duplicates before saving, and let **Google Gemini** suggest a category for each row. Every upload is tracked as an import batch, so a single import can be undone without touching the others.
- **🏦 Bank Accounts & Categories:** Dedicated CRUD flows for accounts (with opening balance and currency) and categories (with icon and color).
- **🌎 Multi-Currency:** Transactions store the original currency, the exchange rate and the amount converted to the user's default currency. Rates are fetched from `open.er-api.com` and cached for 12 hours.
- **🔐 Authentication:** Signup, login and logout backed by a signed JWT stored in an `httpOnly` cookie (7-day sessions), plus a one-click **Try demo** entry point.
- **🎨 Responsive UI/UX:** Premium and responsive layout powered by Tailwind CSS and shadcn/ui, optimized across mobile, tablet and desktop viewports.
- **⚡ Server-Side Power & Reactivity:** Data fetching and mutations run entirely on the server, with `revalidatePath` keeping the UI in sync after every action.

---

## 🚀 Tech Stack

| Layer             | Technology                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, React Server Components, Server Actions)           |
| Language          | TypeScript                                                                  |
| UI & Styling      | Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react                          |
| Charts            | shadcn/ui Charts (Recharts under the hood)                                  |
| Database          | MySQL 8                                                                     |
| ORM               | Drizzle ORM + Drizzle Kit                                                   |
| Validation        | Zod                                                                         |
| Authentication    | `jose` (JWT) + `bcryptjs` (password hashing)                                |
| AI                | Google Gemini via `@google/genai`                                           |
| File parsing      | `papaparse` (CSV), `xlsx` (Excel), `pdfjs-dist` (PDF)                       |
| Testing           | Vitest + Testing Library, Playwright                                        |
| Containerization  | Multi-stage Dockerfile + Docker Compose                                     |
| Hosting           | Vercel (app) and Railway (MySQL)                                            |

---

## 🏗 Architecture

### High-level overview

```mermaid
flowchart LR
    B["Browser"] -->|"HTTP"| N["Next.js 16<br/>App Router"]
    N -->|"Server Actions + Queries<br/>Drizzle ORM"| DB[("MySQL 8")]
    N -->|"@google/genai"| G["Google Gemini API"]
    N -->|"HTTPS"| FX["open.er-api.com<br/>exchange rates"]
```

The app is a single Next.js deployment with **no separate backend**. Reads and writes happen in the same process, split into server-only modules under `server/`.

### Layer map

| Path                          | Responsibility                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `app/<feature>/page.tsx`      | Route entry point (React Server Component).                                     |
| `app/<feature>/_components/`  | Feature-scoped client components (forms, tables, cards, action menus).          |
| `app/<feature>/schema/`       | Zod schemas used to validate that feature's form submissions.                   |
| `server/<feature>/actions.ts` | `"use server"` mutations: parse `FormData` → Zod → Drizzle → `revalidatePath`.   |
| `server/<feature>/queries.ts` | Read-only Drizzle queries, each wrapped in try/catch returning a result object.  |
| `types/<feature>.types.ts`    | Shared TypeScript contracts used by both the `app/` and `server/` sides.        |
| `db/`                         | Drizzle client (`index.ts`), schema (`schema/`) and seed scripts (`seeds/`).     |
| `lib/`                        | Cross-cutting helpers: JWT, AI client, currency conversion, file parsers.        |

### Mutation flow

Every form follows the same pattern:

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client Component
    participant A as Server Action
    participant Z as Zod
    participant D as Drizzle / MySQL
    U->>C: submits form
    C->>A: formAction(FormData)
    A->>Z: safeParse
    Z-->>A: data or field errors
    A->>D: insert / update / delete
    A->>A: revalidatePath()
    A-->>C: success, message, fields
    C->>U: toast + redirect
```

Validation failures return `{ success: false, error, fields }` so the form can repopulate inputs and show per-field messages. Pages that need to branch on device type (for example, the transactions table vs. card view) detect it **server-side** with `headers()` + `userAgent()`, not with client-side media queries.

### Authentication

- Passwords are hashed with `bcryptjs` on signup and compared with `bcrypt.compare` on login.
- A successful login signs a JWT (`HS256`, payload `{ userId }`, 7-day expiry) with `JWT_SECRET` and stores it in the `session` cookie (`httpOnly`, `sameSite=lax`).
- `server/session.ts` resolves the cookie into a user, distinguishing `authenticated`, `unauthenticated` and `db-unavailable` states; the `(app)` layout redirects accordingly.
- `loginAsDemo` sets a session for the seeded user `id = 1`, which is what the **Try demo** button calls.

### Data model

| Table            | Purpose                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `users`          | Accounts, hashed password, default currency.                                                    |
| `bank_accounts`  | Accounts owned by a user, with bank name, type, currency and opening balance.                   |
| `categories`     | Income/expense categories with icon and color; `userId` is `NULL` for the shared defaults.      |
| `transactions`   | Amount, type, date, category, account, currency, exchange rate and converted amount.            |
| `import_batches` | One row per bulk upload, with file hash, row counts and an `undoneAt` marker.                   |
| `currencies`     | Currency catalogue (code, name, symbol, active flag).                                           |

`transactions` enforces a unique index on `(account_id, dedupe_hash, dedupe_occurrence)`, which is how re-importing the same statement is prevented. Timestamps are centralized in a `timestamps` helper (`createdAt`, `updatedAt`, `deletedAt`); soft-delete columns exist in the schema but are not honored by every query yet.

---

## 🧰 Requirements

- **Node.js** ≥ 20.9 (the Docker image uses Node 22)
- **MySQL 8** (local, Docker, or a managed instance such as Railway)
- **Google Gemini API key** — only needed for AI category suggestions during bulk import

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
DATABASE_URL=
JWT_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=
```

| Variable         | Required | Description                                                                                 |
| ---------------- | -------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Yes      | MySQL connection string, e.g. `mysql://user:password@host:3306/database`.                    |
| `JWT_SECRET`     | Yes      | Secret used to sign session tokens. Login, signup and **Try demo** fail without it.          |
| `GEMINI_API_KEY` | For AI   | Google AI Studio key. Bulk import still works without it; AI suggestions do not.             |
| `GEMINI_MODEL`   | For AI   | Model id enabled for your key. The code has **no active fallback**, so it must be set.       |

### Getting the Gemini credentials

1. Create an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy it into `GEMINI_API_KEY`.
3. Set `GEMINI_MODEL` to a model your key can access. Check the model list in AI Studio — the reference value used during development was `gemini-3.5-flash`.

Gemini is used in a single place: `server/transactions/ai-actions.ts` asks it to map imported transactions to existing categories (max. 200 rows, processed in batches of 40). Everything else works without the key.

---

## 🛠️ Local Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/DiegoMD4/finance_tracking.git financial-control
cd financial-control
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure the environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `JWT_SECRET` and (optionally) the Gemini values as described above.

### 4. Create the schema and seed data

```bash
npm run db:migrate
```

This applies every migration in `drizzle/` and loads the default categories, the demo user, and demo accounts/transactions.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **Try demo** or create an account at `/signup`.

> The seeded demo users store plain-text passwords while the login form validates with `bcrypt`, so use the **Try demo** button instead of typing demo credentials.

---

## 🐳 Run with Docker

No Node.js or MySQL installation required — only Docker.

```bash
cp .env.docker.example .env.docker   # then fill in JWT_SECRET and the Gemini values
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

Compose starts MySQL, waits for it to be healthy, applies migrations and seeds, and only then starts the app. See **[DOCKER.md](./DOCKER.md)** for the full guide: services, environment variables, image stages, commands, backups and troubleshooting.

---

## 📜 Available Scripts

| Script                      | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `npm run dev`               | Start the development server.                                      |
| `npm run build`             | Production build (generates `.next/standalone`).                   |
| `npm run start`             | Serve the production build locally.                                |
| `npm run lint`              | Run ESLint.                                                        |
| `npm run typecheck`         | Run `tsc --noEmit`.                                                |
| `npm run format`            | Format `.ts`/`.tsx` files with Prettier.                           |
| `npm test`                  | Run unit tests with Vitest.                                        |
| `npm run test:e2e`          | Run end-to-end tests with Playwright.                              |
| `npm run db:generate`       | Generate a new migration from schema changes.                      |
| `npm run db:migrate`        | Apply migrations, then run the seed and demo seed.                 |
| `npm run db:push`           | Push the schema directly (no migration files), then seed.          |
| `npm run db:seed`           | Seed default categories and the demo user.                         |
| `npm run db:seed-demo`      | Seed demo accounts, transactions and an import batch.              |
| `npm run db:clean`          | Delete all app data (transactions, batches, accounts, users).       |

---

## 📐 Engineering Notes

- **End-to-end type safety:** shared interfaces in `types/` enforce contracts between queries, Server Actions and UI components.
- **Consistent feature structure:** every feature repeats the same four layers (`app/`, `server/actions.ts`, `server/queries.ts`, `types/`), so a new feature is a matter of copying the shape.
- **Fail-soft queries:** `server/*/queries.ts` never throw to the caller; they return a result object the UI can render as an error state.
- **Server-side device detection:** mobile vs. desktop layouts are decided from the request's user agent, avoiding layout flashes.
- **Database-level deduplication:** import duplicates are rejected by a unique index, not only by application logic.

---

## 🔒 License

Distributed under the MIT License. See `LICENSE` for more information.

---

# 📬 Contact & Connections

**Diego Montoya**  
Software Engineer & Frontend Developer

- 🔗 LinkedIn: [linkedin.com/in/diego-montoya1701](https://www.linkedin.com/in/diego-montoya1701)
- 💻 GitHub: [github.com/DiegoMD4](https://github.com/DiegoMD4)
- 📧 Email: diego.montoya1701@outlook.com
