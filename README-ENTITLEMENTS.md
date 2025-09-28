Entitlements across subdomains

Overview
- The main app issues short-lived JWTs with the user's entitlements via POST /api/entitlements/token. Subdomain apps can verify this token and gate features.

How to request a token (from a logged-in session on main domain)
- POST /api/entitlements/token
- Response: { token, entitlements: string[], customerId, expiresIn }

JWT
- HS256 signed with ENTITLEMENTS_JWT_SECRET
- Claims: { sub, customerId, entitlements[], iat, exp, iss }

Suggested subdomain flow
1) On first visit, redirect users to main domain for Clerk SSO if needed.
2) From subdomain, open a popup or cross-domain request to main domain endpoint that returns the entitlements JWT (consider CORS/setup if calling directly).
3) Subdomain verifies JWT using the shared ENTITLEMENTS_JWT_SECRET or via a verification endpoint on the main domain.
4) Cache entitlements briefly (<= token expiry) and refresh periodically.

Security notes
- Use short expiry (10 minutes). Refresh as needed.
- Prefer verifying tokens server-side on each subdomain. Avoid exposing the secret to browsers on subdomains.
- If verifying client-side, do NOT ship ENTITLEMENTS_JWT_SECRET to the client. Instead, add a verification endpoint on each subdomain server that calls main domain or shares the secret securely.


Project selection per billing period (one app at a time)

Scenario
- Apprentice plan grants entitlement like `pos.basic`, which should allow access to ONE app at a time (Qubito, Nexia, Nexora, Soja). Users can switch, but only at the end of their current billing period.

Data model
- New table `ProjectSelection` keyed by `(customerId, entitlementCode)` with:
	- `currentProject`: currently active app slug (e.g., `qubito`).
	- `pendingProject` + `pendingEffectiveAt`: scheduled change to apply at period end.

APIs
- POST `/api/projects/select` body `{ entitlementCode, project }`
	- If no previous selection, sets `currentProject` immediately.
	- If already set, schedules a change at the customer's `currentPeriodEnd` for that entitlement (pulled from Entitlement/Subscription), or falls back to ~30 days if missing.
- GET `/api/projects/current?entitlementCode=pos.basic`
	- Returns the current selection; if a pending change is due, it is applied lazily on read.

Token scoping (aud)
- POST `/api/entitlements/token` accepts `{ entitlementCode, aud }`.
	- When `aud` is provided (e.g., `qubito`), we check it matches the `currentProject` for that entitlement; otherwise 403.
	- The token is issued with `aud` claim.
- POST `/api/entitlements/verify` accepts `{ token, expectedAud, entitlementCode }` and ensures:
	- Token signature/exp are valid.
	- Token `aud` equals `expectedAud`.
	- Current selection in DB is the same `expectedAud` (applying pending if due).

Typical flow
1) User purchases Apprentice. Webhook syncs entitlements and period end.
2) User picks their app: POST `/api/projects/select { entitlementCode: 'pos.basic', project: 'qubito' }`.
3) Subdomain requests a token: POST `/api/entitlements/token { entitlementCode: 'pos.basic', aud: 'qubito' }`.
4) Subdomain server verifies: POST `/api/entitlements/verify { token, expectedAud: 'qubito', entitlementCode: 'pos.basic' }` with `x-api-key`.
5) If user schedules a switch to `nexora`, it takes effect at period end; until then `qubito` remains valid.

Notes
- Expose `pendingEffectiveAt` in your UI via `/api/projects/current` so users see when their switch will happen.
- Works per entitlement; if a plan granted multiple entitlements, you can hold one app per entitlement.
- After updating the Prisma schema, run `prisma generate` and create a migration to add the `ProjectSelection` table.
