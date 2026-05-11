require('dotenv').config();

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const adminEmail = String(process.env.SMOKE_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.SMOKE_ADMIN_PASSWORD || '').trim();
const runId = Date.now();

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (_err) {
    payload = { message: text };
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${payload?.error?.message || payload?.message || response.status}`);
  }
  return payload;
}

async function createUser(index) {
  const email = `smoke-user-${runId}-${index}@example.com`;
  const password = 'StrongPassword123!';
  const name = `Smoke User ${index}`;

  const register = await request('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return { email, password, register, login };
}

async function main() {
  console.log(`Running Modern Library smoke test against ${baseUrl}`);

  const users = [];
  for (let index = 1; index <= 3; index += 1) {
    users.push(await createUser(index));
  }

  const primary = users[0];
  const token = primary.login.token;

  const resources = await request('/api/ai/resources?q=study&limit=5', { token });
  const firstResource = [
    ...(resources.items?.books || []),
    ...(resources.items?.courses || []),
    ...(resources.items?.pastPapers || []),
  ][0];

  const chat = await request('/api/ai/chat', {
    method: 'POST',
    token,
    body: {
      message: 'Help me revise binary search for exams.',
      ...(firstResource
        ? {
          resourceSelections: [{
            resourceType: firstResource.resourceType || firstResource.type,
            resourceId: firstResource.resourceId || firstResource.id,
          }],
        }
        : {}),
    },
  });

  const resumed = await request(`/api/ai/conversations/${chat.sessionId}`, { token });
  await request(`/api/ai/conversations/${chat.sessionId}`, {
    method: 'PATCH',
    token,
    body: { status: 'archived' },
  });
  await request(`/api/ai/conversations/${chat.sessionId}`, {
    method: 'PATCH',
    token,
    body: { status: 'active' },
  });

  let adminChecks = { skipped: true };
  if (adminEmail && adminPassword) {
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: adminPassword },
    });
    const adminToken = adminLogin.token;

    const queueReport = await request('/api/queues/report', { token: adminToken });
    const telemetryReport = await request('/api/ai/telemetry/report?range=daily', { token: adminToken });
    const opsReport = await request('/api/system/ops-report', { token: adminToken });

    adminChecks = {
      skipped: false,
      queueItems: queueReport.items?.length || 0,
      telemetryRequests: telemetryReport.summary?.totalRequests || 0,
      alerts: opsReport.alerts?.length || 0,
    };
  }

  console.log(JSON.stringify({
    success: true,
    usersCreated: users.length,
    chatSessionId: chat.sessionId,
    resumedMessages: resumed.history?.length || 0,
    resourceAttached: Boolean(firstResource),
    adminChecks,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
