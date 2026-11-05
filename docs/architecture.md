# Melosis CRM architecture

## Boundary

The workspace contains two sibling, independent Git repositories. `melosis-crm-frontend` owns the Next.js App Router UI and typed browser API client. `melosis-crm-backend` owns the Express REST API, business rules, authentication, and Prisma access. MySQL is a dedicated CRM database; there is no connection to the customer SaaS database. No browser code can access Prisma or database credentials.

## Backend modules

Express mounts REST endpoints under `/api/v1`. Controllers parse input and coordinate focused Prisma operations; `validators`, `middleware`, and `utils` hold reusable boundary logic. The database is a modular monolith with User, Session, Lead, Activity, and Task records. A lead belongs to its creator and can have many activities and tasks. Sessions cascade with the owning user; records preserve user references. Lead archive is a timestamp, not a destructive delete.

## Authentication and request protection

The private account is created through `npm run admin:create`; public registration does not exist. Passwords use Argon2id. A random opaque 256-bit cookie value is stored only as a SHA-256 hash in MySQL. Cookies are HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production. Logout revokes one session; password changes revoke all sessions. A per-session random CSRF synchronizer token is issued only to authenticated sessions, stored as a hash, and required for state-changing authenticated requests. Mutations reject a mismatched browser Origin. CORS allows only `FRONTEND_ORIGIN`; the login endpoint has a rate limit. Production must use HTTPS and secret environment configuration.

## Main workflows

Leads move between statuses only when a user chooses a status. Status changes produce timeline records. A call creates an Activity and marks the lead called in one transaction. Follow-ups are Task records; the lead list derives next follow-up from the earliest open task. Completing a task can record a timeline note. CUSTOMER status records conversion time and the lead's onboarding status. CSV preview validates spreadsheet headers and row fields; confirmation processes records in bounded request sizes and can skip existing normalized phone matches. Export escapes formula-leading values.

## Frontend

The workspace shell guards pages by loading `/auth/me`. The shared API helper sends credentials, obtains a CSRF token before mutations, and normalizes server errors. Screens are backed by API data: dashboard, leads, details/timeline, follow-ups, pipeline, customers, transfer, and password settings. Mobile styles collapse navigation and allow horizontal pipeline/table navigation.
