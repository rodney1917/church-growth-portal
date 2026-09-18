# Event & Soul Winning Portal

Production-oriented multi-event portal for registration, QR check-in, transport, soul capture and follow-up. The first seeded event is Night of a Thousand on 4 October 2026 (Africa/Lusaka).

Phase 2 adds multi-organization access, separate person contacts, safe duplicate review, configurable journey stages, baptism progress, Invite 5, SMS integration boundaries, leadership reports and CSV exports. Phone numbers are optional and are never person identifiers.

## Local setup

1. Copy `.env.example` to `.env` and replace every secret.
2. Start an independent PostgreSQL database: `docker compose up -d db`.
3. Install packages: `pnpm install`.
4. Apply migrations: `pnpm db:migrate`.
5. Generate the client and seed roles, admin and first event: `pnpm db:generate && pnpm db:seed`.
6. Start the portal: `pnpm dev`.

The seed administrator is controlled by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Change the temporary password immediately.

## Coolify deployment

Create a new application from this repository and select Dockerfile deployment. Create a new, private PostgreSQL resource for this application only; do not reuse or expose an existing production database. Add all variables from `.env.example`, using the Coolify internal database hostname in `DATABASE_URL`. Set the health check path to `/api/health` and container port to `3000`.

Run `pnpm prisma migrate deploy` and `pnpm db:seed` once from the application terminal after the database is available. Attach a new domain and enable HTTPS. Camera scanning requires HTTPS on phones.

Migration `0002_church_growth_foundation` is additive. It removes the unique-phone constraint, makes legacy phone columns nullable, copies existing phone values into `PersonContact`, and adds organization, journey, duplicate-review and invitation tables. It does not drop Phase 1 tables or records. Back up production before applying any migration.

## Security notes

QR codes contain random tokens only. Passwords use bcrypt, sessions are signed HTTP-only cookies, and every protected action checks permissions on the server. Follow-up notes require a separate permission. Public registration is validated and rate-limited. Integration clients authenticate with `x-api-key` using `INTEGRATION_API_KEY`.

## Integration API

- `GET /api/integrations/registration?q=...` searches registration status.
- `POST /api/integrations/sms` accepts authenticated inbound `NIGHT`, `YES`, and `NO` commands for asynchronous processing.
- `PATCH /api/integrations/invitations/{token}` records queued, sent, delivered, or failed delivery state.
- `GET /api/reports/export?eventId=...&type=...` exports authorized CSV reports.

All integration calls use `x-api-key`. PostgreSQL remains authoritative; WAHA, SMS gateways, and n8n only transport messages and commands.

## Required environment

`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `INTEGRATION_API_KEY`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` are required. WAHA, n8n, and SMS variables are optional until those outbound integrations are enabled.
