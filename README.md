# Melosis CRM API

Private Express + Prisma API for the CRM. MySQL is isolated in the dedicated `melosis_crm` database; this service never connects to the Melosis customer SaaS database.

## Setup

Prerequisites: Node.js 20+, npm, and MySQL 8. Create a dedicated database and least-privilege database user (do not reuse the Melosis product database), then copy `.env.example` to `.env` and configure `DATABASE_URL` and `FRONTEND_ORIGIN`. For a local MySQL shell, for example:

```sql
CREATE DATABASE melosis_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'replace-with-a-unique-local-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON melosis_crm.* TO 'crm_user'@'localhost';
```

Use a secret manager or a local untracked `.env` file. Do not commit `.env`.

```sh
npm install
npm run db:generate
npm run db:deploy
npm run admin:create
npm run dev
```

`db:deploy` applies the checked-in migrations without resetting data. Use `npm run db:migrate` when authoring a new migration in development; Prisma Migrate Dev needs permission to create a temporary shadow database. Keep that extra privilege in a developer-only database account.

The administrator command prompts for the initial superadmin's name, email, and password. The first account is the superadmin; after signing in, they can create regular workspace users from Settings. Public registration is not exposed over HTTP. The frontend must use the same site as the API in production so its SameSite=Lax session cookie is sent on credentialed API calls. API base URL is `http://localhost:4000/api/v1`.

## Commands

`npm run typecheck`, `npm run build`, `npm start`, `npm run db:migrate`, and `npm run db:deploy` (production migration deployment). Back up MySQL with your normal encrypted, tested database backup process. Production requires HTTPS and secure cookies; set `NODE_ENV=production`, configure the trusted proxy only when applicable, and use exact origins.

For deployment, install with `npm ci`, set production environment variables through the host's secret manager, run `npm run db:generate` and `npm run db:deploy`, create the founder account once with `npm run admin:create`, then run `npm run build` and `npm start`. Terminate TLS at a trusted reverse proxy. Use the proxy setting only when the API is actually behind that proxy. Keep migration credentials separate from the API runtime user where possible. Test database restore procedures regularly; never run `prisma migrate reset` against a real CRM database.

## API

Authentication: login, logout, current user, change password. Superadmin-only user management is available at `GET` and `POST /api/v1/users`; created accounts always receive the regular user role. Protected routes include dashboard summary/feed, paginated leads CRUD/archive/status, activities, task list/create/update/complete/cancel, and CSV export. Mutation requests require the CSRF token returned by `GET /api/v1/auth/csrf` in `x-csrf-token`. Import preview/commit accepts CSV text through `/leads/import/preview` and `/leads/import/confirm`.
