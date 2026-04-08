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

## In Progress
- Full validation coverage on all legacy mutation routes outside newly added modules.
- End-to-end provider wiring for MFA delivery and notification channels.
- Realtime Redis integration test profile in CI (env-gated skeleton added).

## Blocked
- External provider integration for production email/SMS OTP delivery.
  Blocker: provider credentials and vendor selection not finalized.
- Production Redis-backed queue/realtime smoke tests in CI.
  Blocker: CI environment Redis service not provisioned yet.

## Next Exact Step
1. Provision Redis in CI/staging and enable full queue+realtime integration tests.
2. Choose OTP/email provider and wire MFA + notification dispatch to real channels.
3. Extend validation middleware coverage to all remaining legacy mutation routes.
