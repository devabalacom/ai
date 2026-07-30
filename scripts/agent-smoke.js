const baseUrl = (process.env.AGENTHUB_URL || 'http://89.208.97.82').replace(/\/$/, '');

async function readJson(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function readText(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  return { response, text };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function statusAllowed(actual, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert(allowed.includes(actual), label + ' returned HTTP ' + actual + ', expected ' + allowed.join(' or '));
}

async function main() {
  const { response, data } = await readJson('/api/health', { cache: 'no-store' });
  assert(response.ok, 'health endpoint failed: HTTP ' + response.status);
  assert(data && data.ok, 'health returned non-ok payload');
  const agentBrainReady = Object.prototype.hasOwnProperty.call(data, 'agentBrainReady')
    ? Boolean(data.agentBrainReady)
    : Boolean(data.agentBrainConfigured && data.agentBrainAuthenticated && !data.agentBrainLastError);
  assert(data.agentBrainConfigured, 'agent brain URL is not configured');
  assert(data.agentBrainAuthenticated, 'agent brain auth token/password is not configured');
  assert(agentBrainReady, 'agent brain is not ready: ' + (data.agentBrainLastError || 'unknown error'));

  const warnings = [];
  if (!data.imageGenerationConfigured) {
    warnings.push('image generation is not configured: OPENAI_API_KEY is missing or empty');
  }

  const index = await readText('/', { cache: 'no-store' });
  assert(index.response.ok, 'index page failed: HTTP ' + index.response.status);
  assert(index.text.includes('AgentHub'), 'index page does not look like AgentHub');

  const app = await readText('/app.js', { cache: 'no-store' });
  assert(app.response.ok, 'app.js failed: HTTP ' + app.response.status);
  assert(app.text.includes('AGENTHUB_API_BASE'), 'app.js does not look like the AgentHub client bundle');

  const styles = await readText('/styles.css', { cache: 'no-store' });
  assert(styles.response.ok, 'styles.css failed: HTTP ' + styles.response.status);
  assert(styles.text.includes('--accent'), 'styles.css does not look like the AgentHub stylesheet');

  const me = await readJson('/api/me', { cache: 'no-store' });
  statusAllowed(me.response.status, 401, 'unauthenticated /api/me');

  const users = await readJson('/api/users', { cache: 'no-store' });
  statusAllowed(users.response.status, [200, 401], 'unauthenticated /api/users');

  const unauthorizedMessage = await readJson('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'smoke' })
  });
  statusAllowed(unauthorizedMessage.response.status, 401, 'unauthenticated /api/message');

  const missingApi = await readJson('/api/smoke-missing', { cache: 'no-store' });
  statusAllowed(missingApi.response.status, 404, 'missing API route');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    agentBrainReady,
    imageGenerationConfigured: Boolean(data.imageGenerationConfigured),
    checked: [
      'health',
      'static index/app/styles',
      'auth gates',
      'missing API route'
    ],
    warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
