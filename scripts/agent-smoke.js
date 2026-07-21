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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    agentBrainReady,
    imageGenerationConfigured: Boolean(data.imageGenerationConfigured),
    warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
