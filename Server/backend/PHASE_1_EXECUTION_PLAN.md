# Phase 1 Execution Plan (90 Days)

## 1) Delivery Structure

### Sprint Cadence
- Sprint length: 2 weeks
- Total sprints: 6
- Release train: end of every sprint to staging, every 2 sprints to production

### Team Lanes
- Platform/Security lane
- Learning + AI lane
- Kids Universe lane
- Commerce + Partner lane
- Ops/QA lane

## 2) Sprint-by-Sprint Plan

### Sprint 1 (Days 1-14): Platform Baseline
- Finalize auth hardening rollout (refresh, revocation, audit logging)
- Add system SLO checks on `/api/system/health` and `/api/system/ready`
- Wire Redis in staging (`REDIS_URL`) for socket adapter + queues
- Add request validation to remaining high-risk routes
- CI: run test + lint + smoke checks on PR

Done when:
- All critical auth/payment/booking routes return standardized error envelopes
- Staging has healthy Redis + Mongo readiness

### Sprint 2 (Days 15-28): AI Copilot + Teacher Workflow v1
- AI Copilot endpoints:
  - revision plan
  - weak-topic map
  - contextual Q&A
- Teacher flow:
  - assignment submission model
  - AI grading draft result
  - teacher approve/override endpoint
- Audit log for grading actions

Done when:
- Teacher can submit, receive AI score draft, approve final grade

### Sprint 3 (Days 29-42): Smart Grouping + Live Learning Upgrade
- Topic clustering service for similar learner interests
- Group recommendation endpoint
- Classroom room policy controls (host-only settings, room lock scaffold)
- Realtime abuse controls: tighten signaling rate policies + alerts

Done when:
- Learners can be matched by topic/level and auto-routed to study group suggestions

### Sprint 4 (Days 43-56): Kids Universe Core
- Launch kids surface API namespace (`/api/kids/*`)
- Build kid profile + parent controls + safe content catalog
- Add progress/rewards tracking
- Add strict kid safety middleware guards

Done when:
- Parent can create kid profile and kid only sees age-banded safe content

### Sprint 5 (Days 57-70): Marketplace + Partner Revenue Reliability
- Add dispute lifecycle on marketplace orders
- Add settlement payout state machine (pending -> processing -> paid/failed)
- Add idempotency to all payment-affecting partner endpoints
- Queue-based notifications (booking approval/completion)

Done when:
- Settlement and partner payout reports are deterministic and replay-safe

### Sprint 6 (Days 71-90): Global Readiness + Go-Live
- Add i18n layer for API content metadata and user locale fallback
- Add compliance package:
  - consent records
  - data export/delete workflow scaffold
- Perf pass: load test realtime + booking + wallet mutation routes
- Production launch checklist + rollback plan

Done when:
- Platform meets launch SLO and compliance baseline for first markets

## 3) Backend Module Breakdown (Exact Scope)

- `auth-core`: tokens, MFA hooks, revocation, session policy
- `observability-ops`: pino logging, request IDs, error codes, audit logs
- `trust-safety`: moderation queue, abuse events, kid safety policy gates
- `ai-copilot`: tutor/chat/planner + prompt guardrails
- `assessment`: assignment, AI grading, teacher finalization
- `live-learning`: classrooms, sessions, attendance, signaling
- `grouping-engine`: topic profile and cohort matching
- `content-catalog`: books, past papers, curriculum assets
- `kids-universe`: kids profiles, content, progress, rewards, parent controls
- `marketplace`: listing, purchase, dispute, reputation
- `mobility-stays`: partner onboarding, cabs, accommodations, applications
- `payments-ledger`: wallet, commission, settlement, payouts
- `jobs-pipeline`: settlement, file processing, notification workers
- `compliance`: consent, retention, DSAR workflows

## 4) Route Map (Phase 1 Target)

### Auth + Security
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/mfa/challenge`
- `POST /api/auth/mfa/verify`

### System/Ops
- `GET /api/system/health`
- `GET /api/system/ready`

### Learning + AI
- `GET /api/past-papers`
- `POST /api/past-papers/upload/base64`
- `POST /api/ai/chat`
- `POST /api/assessment/submissions` (new)
- `POST /api/assessment/submissions/:id/ai-grade` (new)
- `PATCH /api/assessment/submissions/:id/finalize` (new)

### Live + Grouping
- `GET /api/live-classrooms`
- `POST /api/live-classrooms`
- `POST /api/live-classrooms/:classroomId/sessions`
- `POST /api/live-classrooms/sessions/:sessionId/join`
- `POST /api/live-classrooms/sessions/:sessionId/leave`
- `GET /api/grouping/recommendations` (new)

### Kids Universe (new namespace)
- `POST /api/kids/profiles`
- `GET /api/kids/content`
- `POST /api/kids/progress`
- `GET /api/kids/rewards/:kidId`
- `PUT /api/kids/parent-controls/:kidId`

### Commerce + Partner
- `POST /api/marketplace`
- `POST /api/marketplace/:id/buy`
- `POST /api/partners/onboard`
- `POST /api/partners/cab-bookings`
- `PATCH /api/partners/cab-bookings/:id/status`
- `POST /api/partners/accommodations/:listingId/apply`
- `PATCH /api/partners/accommodation-applications/:id/status`
- `GET /api/partners/settlements/my`

## 5) Kids Universe Data Model (Phase 1)

### `KidProfile`
- `userId` (kid account), `parentUserId`, `displayName`
- `birthYear`, `ageBand`, `language`, `avatarUrl`
- `status` (`active`, `paused`)

### `KidContent`
- `title`, `type` (`video`, `game`, `story`, `interactive`)
- `ageBandMin`, `ageBandMax`
- `topics[]`, `learningObjectives[]`
- `safetyRating`, `provider`, `isPublished`

### `KidProgress`
- `kidId`, `contentId`
- `completionPct`, `score`, `timeSpentSec`, `attempts`
- `lastSeenAt`

### `KidReward`
- `kidId`, `points`, `badges[]`, `streakDays`, `unlockables[]`

### `ParentControl`
- `parentUserId`, `kidId`
- `dailyScreenLimitMin`, `allowedTopics[]`, `blockedTopics[]`
- `interactionMode` (`solo_only`, `approved_only`)
- `purchasePinEnabled`

### `KidSafetyEvent`
- `kidId`, `eventType`, `severity`
- `source` (`ai_filter`, `user_report`, `moderation`)
- `actionTaken`, `reviewStatus`

## 6) Safety + Compliance Architecture

### Safety Controls
- Isolated kid routes and role checks
- Age-band content filter at query level
- No open kid-to-kid free chat in Phase 1
- Moderation queue for flagged content/events

### Security Controls
- JWT + refresh rotation + revocation blocklist
- Idempotency on financial/booking writes
- Audit logs for auth, payouts, approvals, grading
- Per-socket/per-room realtime abuse throttles

### Compliance Baseline
- Parent consent tracking (versioned policy acceptance)
- Data minimization for kid profiles
- Retention policy per data class
- DSAR scaffolding: export/delete request workflows

## 7) Monetization by Feature (Fast Business Path)

### AI Copilot
- Freemium daily cap + premium unlimited plan
- Institutional package for schools

### Live Classroom
- Subscription for teacher hosts
- Paid class tickets with platform fee

### AI Grading
- Per-script credit packs
- Department/school bulk licenses

### Marketplace
- Transaction fee on completed sales
- Promoted listings

### Cabs/Hostels
- Booking commissions
- Priority placement for partners

### Kids Universe
- Parent premium plan (safe advanced content + analytics)
- Family bundle with multiple kid profiles

## 8) KPI Targets (90-Day)

### Product KPIs
- DAU/WAU ratio >= 0.25
- 30-day learner retention >= 35%
- 7-day parent retention (kids module) >= 45%

### Learning KPIs
- AI copilot completion rate >= 60%
- Past-paper download-to-study-session conversion >= 30%
- Teacher grading turnaround reduced by >= 40%

### Revenue KPIs
- Marketplace take-rate positive by Sprint 5
- Partner booking commission revenue active by Sprint 5
- First paid subscriptions (AI/kids) by Sprint 6

### Reliability/Security KPIs
- API p95 latency < 350ms for core reads
- 0 critical auth/payment vulnerabilities in pentest
- 99.9% uptime for `/health` and `/ready`

## 9) Go-Live Checklist

### Engineering
- All critical routes validated + idempotent where needed
- Redis and queue workers deployed separately
- Backups + restore test completed
- Load test reports attached

### Security
- Secrets rotated and verified
- Pentest high/critical findings closed
- Audit log integrity checks pass

### Compliance
- Terms/privacy/consent flows live
- Parent controls and kid safety defaults enforced
- Data export/delete support documented

### Business
- Pricing published
- Support SLA and incident runbooks ready
- Partner contracts for commission flows active

---

## Immediate Next Build Queue (Start Tomorrow)
1. Implement `/api/kids/*` models + routes + parent guard middleware.
2. Build `assessment` module (submission -> AI grade draft -> teacher finalize).
3. Add queue processors for real notification delivery and settlement payout execution.

## Progress Snapshot (Implemented)
- Kids Universe backend MVP delivered with kid-safe filtering and parent controls.
- Assessment + AI grading backend delivered with teacher override audit.
- Compliance core delivered (consent + DSAR request/status + retention sweep trigger scaffold).
- Entitlement/subscription + dispute + finance summary modules delivered.
- Realtime moderation controls delivered (lock/mute/remove) with anti-spam signaling limits.
- Queue replay + metrics endpoints delivered for operational recovery.
