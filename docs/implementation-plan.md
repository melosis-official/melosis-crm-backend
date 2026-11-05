# Implementation plan and delivery status

## Delivery phases

1. Inspect workspace and establish sibling repositories. **Done:** empty workspace; two independent Git repositories initialized.
2. Document architecture and business workflows. **Done.**
3. Implement MySQL/Prisma schema and protected Express APIs. **Implemented:** authentication/session and CSRF, lead CRUD/archive/status, activities, task workflows, dashboard aggregation, CSV import/export, validation and centralized errors.
4. Implement Next.js interface and connect it to the API. **Implemented:** login, dashboard, lead list/forms/details, interaction logging, follow-up tasks, grouped pipeline, customers/onboarding, CSV transfer, account password change.
5. Build and offline verification. **Done:** installed dependencies from the available cache, validated the Prisma schema, generated the client, passed backend/frontend type checks and production builds, and passed backend CSV utility tests. Live MySQL migrations and end-to-end authenticated API flows remain pending because no MySQL client or running MySQL service is available in this workspace.

## Operational setup requirements

Create an empty dedicated MySQL database and a least-privilege service user. Configure backend `.env` from `.env.example` and frontend `.env.local` from its `.env.example`. Install project dependencies, generate Prisma Client, apply the initial migration, create an administrator using the CLI, then run the API and UI. Production requires TLS, secure cookies, exact CORS origin, trusted proxy configuration only behind a known proxy, separate migration/runtime database credentials where practical, and regular tested backups.

## Verification record

- `prisma validate`: passed against the committed schema using a placeholder MySQL URL (no connection attempted).
- Backend `typecheck` and `build`: passed.
- Backend CSV and request-schema unit tests: 6 passed.
- Frontend `typecheck` and Next.js production build: passed.
- MySQL migrations, authentication flows, and database-backed lead/task workflows: not run; no local MySQL server is installed or running.

## Deliberate scope limits

Single founder workspace; no public signup, tenant management, RBAC, billing, outbound messaging, or external reminder providers. CSV data is processed per request and is limited to 5 MB and 1,000 rows. Larger imports should be split into files of at most 1,000 records.
