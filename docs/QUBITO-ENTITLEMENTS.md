# Qubito Entitlements Integration

This document explains how the main landing page issues and validates entitlements for the Qubito app when it is hosted on a dedicated subdomain. Share it with any tooling or AI assistant attached to the Qubito codebase so it understands the contract with the landing page.

## Components
- Main domain (landing page / admin) at `pixelgrimoire.com` hosts the entitlement API and owns customer records.
- Qubito subdomain at `qubito.pixelgrimoire.com` consumes entitlement tokens to decide whether a user can access protected features.
- Clerk manages session state on the main domain. Subdomains rely on the tokens issued by the main domain rather than storing Clerk secrets locally.
- Stripe webhooks sync active subscriptions and period boundaries into the landing page database.

## High level flow
1. User authenticates on the main domain (Clerk session exists in the browser).
2. Qubito detects missing or expired entitlements and opens a short-lived popup (or hidden `fetch`) to `https://pixelgrimoire.com/api/entitlements/token`.
3. The landing page validates the session, checks `pos.basic` (or the requested entitlement), verifies the ProjectSelection table, and issues a JWT scoped to `aud: "qubito"`.
4. Qubito verifies the JWT server-side using the shared secret (or by calling `/api/entitlements/verify`).
5. Qubito caches the entitlements for at most the token lifetime and refreshes when needed.

## Token shape
- Algorithm: HS256, secret `ENTITLEMENTS_JWT_SECRET` shared between main domain and Qubito infrastructure.
- Claims: `sub`, `customerId`, `entitlements[]`, `aud`, `iat`, `exp`, `iss`.
- Lifetime: 10 minutes (configurable via landing page settings).

## Required API endpoints
### `POST https://pixelgrimoire.com/api/entitlements/token`
Request body:
```json
{
  "entitlementCode": "pos.basic",
  "aud": "qubito"
}
```
Response body:
```json
{
  "token": "...",
  "entitlements": ["pos.basic"],
  "customerId": "cus_123",
  "expiresIn": 600
}
```

### `POST https://pixelgrimoire.com/api/entitlements/verify`
Optional server-side verification from Qubito if you do not want to ship the shared secret to the subdomain server. Provide the token and the expected `aud`. A 200 response confirms validity; otherwise expect `403` or `401`.

### `GET https://pixelgrimoire.com/api/projects/current?entitlementCode=pos.basic`
Used to display the active and pending project selection. The landing page applies pending switches lazily when the period ends.

### `POST https://pixelgrimoire.com/api/projects/select`
Triggers a change of project selection when users pick a different subdomain app. Qubito only needs to consume this indirectly: if a user schedules a switch away from Qubito, the next token request after the effective date will fail with `403`.

## Qubito server responsibilities
- Store `ENTITLEMENTS_JWT_SECRET` securely (environment variable).
- Create an internal helper (`verifyEntitlementsToken`) that validates signature, expiry, and required claims.
- Match the returned `customerId` to local records. If Qubito does not store customer IDs, rely on `sub` and fetch the latest profile data from the landing page.
- Include `aud: "qubito"` on every token request. Without it, the landing page cannot enforce the ProjectSelection restriction.
- Revalidate tokens frequently. Do not rely on tokens longer than the `exp` time.

Example Node helper:
```ts
import jwt from "jsonwebtoken";

const ENTITLEMENTS_SECRET = process.env.ENTITLEMENTS_JWT_SECRET!;

export function verifyEntitlementsToken(token: string) {
  const payload = jwt.verify(token, ENTITLEMENTS_SECRET, {
    audience: "qubito",
    issuer: "pixelgrimoire-entitlements"
  });

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid entitlements token");
  }

  if (!Array.isArray(payload.entitlements)) {
    throw new Error("Missing entitlements array");
  }

  return payload;
}
```

### Implemented Qubito endpoint
Qubito provides `GET/POST /api/qubito/entitlements` to verify a token returned by the landing page.

- Request (POST):
  - Body: `{ "token": "<jwt>", "required": "pos.basic" }` (optional `aud`, defaults to `"qubito"`).
- Request (GET):
  - Query: `?token=<jwt>&required=pos.basic&aud=qubito`.
- Response: `200` with `{ ok, entitlements, sub, customerId, iat, exp }` or `401/403` on failure.

Client flow example:
1. Frontend calls `POST ${ENTITLEMENTS_BASE_URL}/api/entitlements/token` with `credentials: 'include'`.
2. Receive `{ token }` and POST it to `/api/qubito/entitlements` with `required: 'pos.basic'`.
3. If `200`, cache entitlements client-side for up to `exp`.
4. If `401`, redirect user to login on landing. If `403`, show upgrade/switch UI.

## Frontend workflow inside Qubito
- On app boot, call `/api/qubito/entitlements` (a Qubito-owned endpoint) that wraps the token exchange.
- If the backend endpoint returns `401`, redirect users to the landing page for sign-in (`https://pixelgrimoire.com/login?redirect=https://qubito.pixelgrimoire.com`).
- If the backend endpoint returns `403`, show the subscription upgrade UI or the scheduled switch message. Fetch `/api/projects/current` to display `pendingEffectiveAt` and the target app.

## Local development
- Run the landing page locally on `localhost:3000` with Clerk dev environment.
- Expose the entitlements endpoints through a tunnel (e.g., `ngrok`) if Qubito runs on another dev machine.
- Set `ENTITLEMENTS_BASE_URL` in Qubito to the reachable landing page origin.
- Use a seeded test customer with `pos.basic` entitlement.

## Monitoring and logging
- Log token issuance events (who, which entitlement, which aud) on the landing page.
- Log verification failures on Qubito to detect expiring secrets or clock drift.
- Alerts: repeated `403` responses on `/api/entitlements/token` should trigger support review.

## Open questions
- Should Qubito support offline mode? If yes, define how long entitlements can be cached locally.
- Do we need per-feature entitlements inside Qubito beyond `pos.basic`? Extend the token claims accordingly.
- If we rotate `ENTITLEMENTS_JWT_SECRET`, coordinate deploys so Qubito accepts both old and new tokens during the transition.
