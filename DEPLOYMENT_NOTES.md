# Modern Library Deployment Notes

## Tester Checklist

### Expected Behaviors

- Signup creates a student account and returns both access and refresh tokens.
- Login opens the tutor workspace and persists the user session locally.
- Expired access tokens are refreshed automatically through `/api/auth/refresh`.
- AI chat creates a session, saves history, and can resume from the sidebar.
- Archive and restore update session state without losing messages.
- Resource selection is included in tutor requests when resources exist in the database.
- Admin queue report, telemetry report, and ops report respond for admin users only.

### Known Limits

- A real staging deploy still requires actual infrastructure secrets and hostnames.
- Resource-selection smoke tests depend on at least one searchable book, course, or past paper existing in the deployed database.
- MFA login flows are supported by the backend but are not yet surfaced in the current frontend MVP.
- Alert delivery is exposed through logs and ops-report payloads; external paging integrations still need platform wiring.

## Backend

- Working directory: `Server/backend`
- Install: `npm install`
- Required production environment:
  - `NODE_ENV=production`
  - `MONGO_URI`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `FRONTEND_URL` or `FRONTEND_URLS`
  - `AI_PROVIDER=openai`
  - `OPENAI_API_KEY`
- Optional worker setup:
  - API process can run workers with `RUN_JOB_WORKER=true`
  - Dedicated worker process: `npm run worker`
- Startup:
  - API: `node server.js`
  - Worker: `npm run worker`
- Production checks:
  - Ensure `FRONTEND_URLS` contains only HTTPS origins
  - Ensure Redis is configured if queue-backed workers are expected
  - Review `.env.example` for AI maintenance and telemetry configuration

## Frontend

- Working directory: `Server/frontend/my-app`
- Install: `npm install`
- Set environment:
  - `REACT_APP_API_BASE_URL=https://your-api-domain`
- Build:
  - Standard: `npm run build`
  - Optimized production build without source maps: `npm run build:prod`
- Output folder:
  - `Server/frontend/my-app/build`

## First-User Testing Checklist

- Verify signup and login against the deployed API
- Verify tutor chat creates and resumes sessions
- Verify resource browser loads and resource attachment works
- Verify session archive/restore works
- Verify production API returns `X-Request-Id` for error tracing
- Verify admin queue endpoints are restricted to admin accounts

## Logging and Security Notes

- Backend logs redact tokens, cookies, OTPs, and challenge identifiers
- Production server errors return generic 500 messages to clients
- CORS exposes only configured frontend origins and returns `X-Request-Id`
- Security headers include CSP, HSTS, CORP, COOP, and permissions restrictions
