# 🐳 Running the App with Docker

This guide runs the whole stack — Next.js app, MySQL database, and migrations — **without installing Node.js or MySQL** on your machine. The only requirement is Docker.

---

## 📦 What gets started

| Service   | Image / build target            | Purpose                                                                                   |
| --------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `db`      | `mysql:8.4`                     | Database server. Data is persisted in the `db_data` volume.                                |
| `migrate` | `Dockerfile` → `builder` stage  | One-shot job: applies Drizzle migrations and loads seed data. Exits when finished.          |
| `web`     | `Dockerfile` → `runner` stage   | Production Next.js server (standalone build) listening on port `3000`.                      |

Startup order is enforced by a healthcheck and dependencies:

```mermaid
flowchart LR
    DB["db<br/>mysql:8.4"] -->|"healthy"| MIG["migrate<br/>one-shot job"]
    MIG -->|"completed successfully"| WEB["web<br/>Next.js :3000"]
```

`web` does not start until `migrate` has exited with code `0`, so the schema and seed data always exist before the first request.

---

## ✅ Requirements

- Docker Engine 24+ or Docker Desktop (Windows / macOS), with Compose v2 (`docker compose version`).
- Port `3000` free on the host.

Nothing else. No local Node, no local MySQL, no `npm install`.

---

## 🚀 Quick start

### 1. Create the environment file

```bash
cp .env.docker.example .env.docker
```

`.env.docker` is git-ignored on purpose — it holds secrets.

### 2. Fill in the values

```env
JWT_SECRET=replace-with-a-long-random-string
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=the-model-id-enabled-for-your-key
```

Generate `JWT_SECRET` with:

```bash
openssl rand -hex 32
```

(or, if you have Node installed: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

> `GEMINI_API_KEY` and `GEMINI_MODEL` are only needed for the AI-assisted category suggestions in the bulk import flow. The rest of the app runs without them. The table below details what breaks when each one is missing.

### 3. Build and start

```bash
docker compose up --build
```

The first run takes a few minutes: it builds the image, waits for MySQL, runs the migrations and seeds, and only then starts the app. When the `web` service logs the Next.js ready message, open:

```text
http://localhost:3000
```

### 4. Sign in

- Click **Try demo** on the login page to enter the seeded demo account (user `1`, with demo accounts, transactions, and one import batch already loaded), **or**
- Create your own account at `/signup`.

> The seeded demo users store their passwords in plain text, while the login form validates with `bcrypt`. That means the demo user cannot be used through the email/password form — use the **Try demo** button instead, or sign up.

---

## ⚙️ Environment variables

Compose builds `DATABASE_URL` for you, so you never write it by hand.

### Database service

| Variable              | Default       | Description                          |
| --------------------- | ------------- | ------------------------------------ |
| `MYSQL_ROOT_PASSWORD` | `rootpass`    | MySQL root password.                 |
| `MYSQL_DATABASE`      | `finance_db`  | Database created on first start.     |
| `MYSQL_USER`          | `finance`     | Application user.                    |
| `MYSQL_PASSWORD`      | `finance`     | Application user password.           |

Override them with a `.env` file in the project root (Compose reads it automatically) or from the shell:

```bash
MYSQL_PASSWORD=something-strong docker compose up --build
```

On Windows PowerShell, set the variable first:

```powershell
$env:MYSQL_PASSWORD="something-strong"; docker compose up --build
```

The resulting connection string used by both `migrate` and `web` is:

```text
mysql://<MYSQL_USER>:<MYSQL_PASSWORD>@db:3306/<MYSQL_DATABASE>
```

Note the host: `db` is the **service name**, not `localhost`. Inside the Compose network, Docker DNS resolves it to the database container.

### Application service (`web`)

Loaded from `.env.docker` via `env_file`.

| Variable         | Required | Used by                    | Effect if missing                                                        |
| ---------------- | -------- | -------------------------- | ------------------------------------------------------------------------ |
| `JWT_SECRET`     | Yes      | `lib/jwt.ts`               | Login, signup and **Try demo** throw `JWT_SECRET is not set`.            |
| `GEMINI_API_KEY` | For AI   | `lib/ai.ts`                | Bulk import still works, but AI category suggestions fail.               |
| `GEMINI_MODEL`   | For AI   | `lib/ai.ts`                | Same as above — the code has no active fallback model.                   |

---

## 🧱 What the `migrate` service does

It runs `npm run db:migrate`, which is:

```text
drizzle-kit migrate && npm run db:seed && npm run db:seed-demo
```

1. **`drizzle-kit migrate`** — applies every migration in `drizzle/` in order. Already-applied migrations are skipped, so it is safe to run repeatedly.
2. **`db:seed`** — inserts the default categories and the demo user.
3. **`db:seed-demo`** — inserts demo bank accounts, transactions and an import batch so the dashboard is not empty.

Seeds are mostly idempotent: the demo user, the demo accounts and the sample import batch are skipped when they already exist. The generated demo transactions, however, are inserted on every run, so repeated runs of the `migrate` service will add more demo movements. Use `docker compose down -v` if you want a clean slate.

To re-run migrations and seeds manually:

```bash
docker compose run --rm migrate
```

---

## 🛠️ Common commands

| Task                              | Command                                              |
| --------------------------------- | ---------------------------------------------------- |
| Start in the background           | `docker compose up -d --build`                        |
| Follow app logs                   | `docker compose logs -f web`                          |
| Follow all logs                   | `docker compose logs -f`                              |
| List services and their state     | `docker compose ps`                                   |
| Stop everything (keeps data)      | `docker compose down`                                 |
| Stop and **delete the database**  | `docker compose down -v`                              |
| Rebuild without cache             | `docker compose build --no-cache && docker compose up` |
| Open a MySQL shell                | `docker compose exec db mysql -u finance -p finance_db` |
| Open a shell inside the app       | `docker compose exec web sh`                          |
| Re-run migrations and seeds       | `docker compose run --rm migrate`                     |

MySQL is **not** published to the host. If you need a GUI client, add a port mapping such as `"3307:3306"` to the `db` service and connect to `127.0.0.1:3307`.

---

## 🏗️ How the image is built

`Dockerfile` is a three-stage build:

| Stage     | Base              | What it does                                                                                   |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `deps`    | `node:22-alpine`  | Copies only `package.json` + `package-lock.json`, then runs `npm ci`. Cached until dependencies change. |
| `builder` | `node:22-alpine`  | Reuses `node_modules` from `deps`, copies the source, runs `next build`. Produces `.next/standalone`. |
| `runner`  | `node:22-alpine`  | Copies only `public/`, `.next/standalone` and `.next/static`. Runs as the non-root `nextjs` user.  |

Key details:

- **`output: "standalone"`** in `next.config.mjs` is what makes the final image small: Next traces the modules actually used at runtime instead of copying the full `node_modules`.
- `public/` and `.next/static` are **not** included in `standalone`, so the runner copies them explicitly. Without them the app would load without styles or client-side JavaScript.
- `HOSTNAME=0.0.0.0` is set in the runner. Without it, the standalone server can bind to the container's hostname and become unreachable from the host.
- The container runs as `nextjs`, not `root`.
- `.dockerignore` keeps `node_modules`, `.next`, `.git` and test artifacts out of the build context.

---

## 🐋 Running the image without Compose

If you only want the app container and already have a reachable MySQL (for example, the one running on Railway):

```bash
# build
docker build -t finance-tracker .

# run
docker run -d \
  --name finance-app \
  -p 3000:3000 \
  --env-file .env.docker \
  -e DATABASE_URL="mysql://user:password@host:3306/database" \
  finance-tracker
```

In this mode **you are responsible for the schema**: run the migrations once against that database before starting the container.

```bash
# macOS / Linux
DATABASE_URL="mysql://user:password@host:3306/database" npm run db:migrate
```

```powershell
# Windows PowerShell
$env:DATABASE_URL="mysql://user:password@host:3306/database"; npm run db:migrate
```

(That last command requires Node locally, or run it as a one-off container with `docker run --rm`.)

---

## 💾 Data persistence

The database lives in the named volume `db_data`, mounted at `/var/lib/mysql`.

- `docker compose down` → containers removed, **data kept**.
- `docker compose down -v` → containers **and** the volume removed. The next `up` starts from an empty database and re-runs migrations + seeds.

To back up the database:

```bash
docker compose exec db mysqldump -u root -prootpass finance_db > backup.sql
```

Replace `rootpass` with your actual `MYSQL_ROOT_PASSWORD`.

---

## 🩺 Troubleshooting

| Symptom                                                        | Cause / fix                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated`       | Another process (or a previous container) uses port 3000. Change the mapping to `"3001:3000"`. |
| Login or **Try demo** fails with `JWT_SECRET is not set`        | `.env.docker` is missing or empty. Create it from `.env.docker.example`.                       |
| AI suggestions fail with `GEMINI_API_KEY is not set`           | Only the AI feature is affected. Add the key to `.env.docker` and restart.                     |
| AI suggestions fail with a model/permission error              | `GEMINI_MODEL` is not enabled for your key. Pick an available model id in Google AI Studio.    |
| `migrate` exits non-zero                                       | Read its logs with `docker compose logs migrate`. It is usually a migration or seed error.     |
| Dashboard is empty after login                                 | The seeds did not run. Run `docker compose run --rm migrate`.                                  |
| Login works but every page redirects back to `/`               | `JWT_SECRET` changed after the cookie was issued. Log in again.                                |
| Build is very slow the first time                              | Normal — it compiles Next.js and installs dependencies. Later builds reuse the layer cache.    |
| `exec format error`                                            | The image was built for a different CPU architecture. Rebuild on the target machine, or build with `--platform` matching it. |

---

## 🔒 Production notes

The Compose file is designed for local use. Before deploying it as-is:

- Replace the default MySQL credentials (`rootpass`, `finance`) with real secrets.
- Keep `JWT_SECRET` in a secret manager, not in a committed file.
- Do **not** publish port `3306` to the host.
- Put a reverse proxy (Caddy, Traefik, Nginx) in front of `web` to terminate TLS.
- Add `restart: unless-stopped` to `web` and `db` so they recover after a host reboot.
- Back up the `db_data` volume, or point `DATABASE_URL` at a managed MySQL instance.
