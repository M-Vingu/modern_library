# Backend Todo Board

## Completed
- Observability baseline (pino logs, request IDs, readiness/liveness).
- Security phase 2 (refresh rotation, token revocation, session endpoints, MFA challenge/verify scaffold).
- Realtime productionization (Redis adapter support, Redis presence fallback, signaling rate limits, moderation actions).
- Queue platform (BullMQ queues, dead-letter routing, replay API, metrics API, graceful worker shutdown).
- Kids Universe MVP backend (models, routes, access controls, age/topic safety filtering).
- Assessment + AI grading module (submission, AI draft, teacher finalization with audit).
- Compliance module (consent records, DSAR requests/status updates, retention sweep trigger scaffold).
- Compliance DSAR admin listing endpoint with filters/pagination.
- Business module (plans/subscriptions, entitlement gating middleware, disputes, finance summary endpoint).
- API docs refresh and architecture/phase docs updates.
- Full validation coverage on legacy mutation routes (auth/user/ai/books/courses/products/rides/hostels/past-papers/partners/live-classroom/queue/compliance sweep).
- OpenAPI request/response examples added for newly validated legacy mutation endpoints and standardized error components.

## In Progress
- Credential onboarding for MFA delivery providers (SMTP/Twilio adapters are implemented).
- Realtime Redis integration test profile in CI (env-gated skeleton added).

## Blocked
- Production credentials for SMTP/Twilio in secure environment store.
  Blocker: secrets provisioning not finalized.
- Production Redis-backed queue/realtime smoke tests in CI.
  Blocker: CI environment Redis service not provisioned yet.

## Next Exact Step
1. Provision Redis in CI/staging and enable full queue+realtime integration tests.
2. Choose OTP/email provider and wire MFA + notification dispatch to real channels.
3. Add staging smoke tests for partner booking and settlement flows with idempotency key replay checks.
