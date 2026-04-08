# Mega App Technical Architecture and Database Schema

## 1. Vision-Aligned Architecture

This backend is organized as modular domain services under one API:

1. Identity and Security:
- JWT authentication
- Refresh-token rotation + token revocation blocklist
- Role-based authorization (`user`, `admin`)
- Rate limiting, request sanitization, security headers
- Request validation layer (Zod) + idempotency keys

2. Learning Core:
- Books and borrowing
- Courses and enrollment
- Past papers repository
- Past paper secure uploads + signed download URLs
- AI tutor scaffold
- Live classroom sessions and attendance tracking
- Realtime classroom transport (Socket.IO + WebRTC signaling relay)
- Assessment + AI grading workflow (draft + teacher finalization)
- Kids Universe module (kid-safe content, progress, rewards, parent controls)

3. Student Commerce:
- Campus marketplace (peer-to-peer)
- Wallet-based purchase flow

4. Mobility and Accommodation:
- Existing ride/transport module
- Partner onboarding (cab/hotel/hostel businesses)
- Cab fleet and bookings
- Accommodation listings and applications

5. Finance and Audit:
- Wallet transactions
- Transaction history endpoints
- Partner settlement ledger (gross, commission, payout)
- Audit log events for critical operations (auth, partner approvals, payouts)
- Finance summary and dispute lifecycle reporting endpoints

6. API Documentation:
- OpenAPI 3.0 specification
- Swagger UI endpoint for developer integration

7. Operations and Reliability:
- Structured logging (`pino` + request IDs)
- Health/readiness probes (`/api/system/health`, `/api/system/ready`)
- Redis-backed queue scaffolding (BullMQ) with dead-letter queues
- Queue replay + metrics admin endpoints

## 2. Deployment Topology (Current)

1. API server:
- Node.js + Express
- Single-process API app (`server.js`)

2. Database:
- MongoDB (Mongoose ODM)
- Environment-driven connection string via `MONGO_URI`

3. Authentication:
- JWT Bearer tokens
- Optional Google OAuth login flow
- Optional Redis-backed token/realtime scaling dependencies

## 3. Data Model (Existing + New)

### Existing core collections
1. `users`
- identity, role, wallet reference, profile locale/currency

2. `wallets`
- one wallet per user
- balance + embedded transaction log

3. `transactions`
- top-level transaction records (wallet/user/book linkage)

4. `books`, `courses`, `products`, `rides`, `hostels`
- core learning + commerce + transport inventory

### New collections added in this iteration
1. `pastpapers` (`PastPaper`)
- title, institution, course, subject, year, examType, fileUrl
- verification and visibility controls
- `downloadCount`, uploader ownership

2. `marketplacelistings` (`MarketplaceListing`)
- seller, listing metadata, category/condition, price/currency
- listing lifecycle (`active`, `sold`, etc)
- buyer reference and sold timestamp

3. `partners` (`Partner`)
- business owner, type (`cab`, `hotel`, `hostel`, `mixed`)
- contact and verification state

4. `cabvehicles` (`CabVehicle`)
- mapped to a partner
- plate, vehicle type, fare settings, driver info

5. `cabbookings` (`CabBooking`)
- student booking against a partner vehicle
- route, schedule, estimated/final fare, status lifecycle

6. `accommodationlistings` (`AccommodationListing`)
- partner-managed hotel/hostel inventory
- unit capacity, availability, pricing, amenities

7. `accommodationapplications` (`AccommodationApplication`)
- student stay applications
- check-in/out dates, status and review notes

8. `kidprofiles`, `kidcontents`, `kidprogresses`, `kidrewards`, `parentcontrols`, `kidsafetyevents`
- Kids Universe account-safe learning data model

9. `assignments`, `assignmentsubmissions`, `aigradedrafts`, `finalgradeaudits`
- Assessment + AI grading and teacher override audit trail

10. `consentrecords`, `dsarrequests`, `retentionpolicies`
- Compliance, consent versioning, DSAR tracking, and retention scaffolds

11. `subscriptionplans`, `usersubscriptions`, `marketplacedisputes`, `userreputations`
- Business entitlement, disputes, and reputation primitives

## 4. API Module Map

1. Past papers:
- `GET /api/past-papers`
- `GET /api/past-papers/:id`
- `POST /api/past-papers` (auth)
- `POST /api/past-papers/upload/base64` (auth)
- `POST /api/past-papers/:id/download` (auth)
- `PATCH /api/past-papers/:id/verify` (admin)
- `GET /api/files/past-papers/download?token=...` (signed URL resolver)

2. Marketplace:
- `GET /api/marketplace`
- `GET /api/marketplace/:id`
- `GET /api/marketplace/my/listings` (auth)
- `POST /api/marketplace` (auth)
- `PATCH /api/marketplace/:id` (auth, owner)
- `POST /api/marketplace/:id/buy` (auth)

3. AI scaffold:
- `GET /api/ai/health`
- `POST /api/ai/chat` (auth)

4. Auth hardening:
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (auth)
- `POST /api/auth/mfa/challenge` (auth scaffold)
- `POST /api/auth/mfa/verify` (auth scaffold)

5. Live classrooms:
- `GET /api/live-classrooms`
- `POST /api/live-classrooms` (auth)
- `GET /api/live-classrooms/realtime/config` (auth)
- `GET /api/live-classrooms/:id`
- `POST /api/live-classrooms/:classroomId/sessions` (auth)
- `GET /api/live-classrooms/:classroomId/sessions`
- `POST /api/live-classrooms/sessions/:sessionId/join` (auth)
- `POST /api/live-classrooms/sessions/:sessionId/leave` (auth)
- `GET /api/live-classrooms/sessions/:sessionId/attendance` (auth teacher/admin)
- Socket events:
- `classroom:join-session`, `classroom:leave-session`
- `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`

6. Partner and mobility/accommodation:
- `POST /api/partners/onboard` (auth)
- `GET /api/partners/my` (auth)
- `GET /api/partners/pending` (admin)
- `PATCH /api/partners/:id/status` (admin)
- `POST /api/partners/:partnerId/cabs` (auth owner/admin)
- `GET /api/partners/:partnerId/cabs`
- `POST /api/partners/cab-bookings` (auth)
- `GET /api/partners/cab-bookings/my` (auth)
- `PATCH /api/partners/cab-bookings/:id/status` (auth owner/admin)
- `POST /api/partners/:partnerId/accommodations` (auth owner/admin)
- `GET /api/partners/accommodations`
- `POST /api/partners/accommodations/:listingId/apply` (auth)
- `GET /api/partners/accommodation-applications/my` (auth)
- `PATCH /api/partners/accommodation-applications/:id/status` (auth owner/admin)
- `GET /api/partners/settlements/my` (auth partner owner)
- `GET /api/partners/settlements` (admin)

## 5. Revenue-Oriented Flows

1. Marketplace transaction fee:
- `MARKETPLACE_FEE_PERCENT` (default 5%)
- buyer pays full amount, seller receives payout minus fee

2. Partner monetization:
- cab booking commissions
- accommodation referral/booking commissions
- future premium placement / promoted listings

3. AI premium opportunities:
- free tier for basic chat
- premium tier for advanced tutoring and grading tools

## 6. API Documentation Endpoints

1. OpenAPI JSON:
- `GET /api/docs/openapi.json`

2. Swagger UI:
- `GET /api/docs`

## 7. Security Architecture

1. Perimeter:
- CORS allowlist
- global rate limiter
- request payload size limits

2. Request hardening:
- sanitization middleware against dangerous keys/operators
- standardized security headers
- standardized error envelope with error codes + request IDs

3. Identity and access:
- JWT verification (issuer/audience optional enforcement)
- role middleware for admin routes
- ownership checks on user-managed resources

4. Consistency and abuse prevention:
- wallet and purchase flows use atomic DB updates/transactions
- race-condition-safe booking patterns in critical modules
- signed short-lived download URLs for protected files
- signaling spam protection via per-socket/per-room rate limits

## 8. Next Build Steps (Recommended)

1. Live classroom service:
- media recording/archival pipeline
- moderator controls (mute, remove participant, lock room)

2. AI grading workflow:
- upload scripts
- AI rubric scoring
- teacher approval gate + immutable grade audit log

3. Research-group matching:
- topic graph + cohort clustering
- opt-in collaborative rooms

4. Production hardening:
- Redis-backed rate limiting
- object storage for documents
- centralized logging and SIEM hooks
- background jobs queue for async processing
