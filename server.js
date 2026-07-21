const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const STATE_DIR = path.join(ROOT, 'data');
const SESSION_COOKIE = 'agenthub_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 64 * 1024);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const WORKFLOW_PROVIDER = process.env.WORKFLOW_PROVIDER || 'openclaw';
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || '';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const OPENCLAW_GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const AGENTS_DIR = path.join(ROOT, 'agents');
let gatewayConfigWarned = false;
const failedLogins = new Map();

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const seedUsers = [
  { id: 'support', name: 'Алина', title: 'Поддержка клиентов', password: process.env.SUPPORT_INITIAL_PASSWORD || '', agentId: 'support-agent' },
  { id: 'sales', name: 'Дамир', title: 'Продажи', password: process.env.SALES_INITIAL_PASSWORD || '', agentId: 'sales-agent' }
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPassword(password, stored) {
  const value = String(stored || '');
  if (value.startsWith('scrypt$')) {
    const parts = value.split('$');
    if (parts.length !== 3) return false;
    const expected = Buffer.from(parts[2], 'base64url');
    const actual = crypto.scryptSync(String(password), parts[1], expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return value === String(password || '');
}

function shouldUpgradePasswordHash(stored) {
  return !String(stored || '').startsWith('scrypt$');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('base64url');
}

function isSecureRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
}

function seedWorkspace(userName, mode, quickActions, tasks, messages, missions, artifacts) {
  return {
    id: userName === 'Алина' ? 'support-agent' : 'sales-agent',
    name: userName,
    title: 'Личный рабочий агент',
    mode: mode,
    model: 'Рабочий агент',
    quickActions: quickActions,
    tasks: tasks,
    messages: messages,
    missions: missions,
    artifacts: artifacts,
    agentConfig: {
      name: '',
      role: '',
      instructions: '',
      setupDone: false
    }
  };
}

function artifactPromptSummary(artifact) {
  return {
    id: artifact.id,
    title: artifact.title,
    type: artifact.type,
    summary: artifact.summary || '',
    content: artifact.type === 'image' ? undefined : String(artifact.content || '').slice(0, 500)
  };
}

const seedWorkspaces = [
  seedWorkspace('Алина', 'approve', [
    'Найди свежую информацию в интернете',
    'Сгенерируй изображение для ответа',
    'Запусти поручение: разобрать тикет',
    'Покажи статус поручений'
  ], [
    { id: 't1', title: 'Ответить на тикет по доступам', details: 'Подготовить короткий черновик ответа', status: 'todo' },
    { id: 't2', title: 'Собрать FAQ', details: 'Вытащить частые вопросы из истории', status: 'waiting' }
  ], [
    { id: 'm1', role: 'agent', author: 'Агент Алины', time: '09:02', text: 'Я уже создан. Пиши сюда как в Telegram, API тебе не нужен.' },
    { id: 'm2', role: 'user', author: 'Алина', time: '09:03', text: 'Сделай черновик ответа на тикет по доступам.' },
    { id: 'm3', role: 'agent', author: 'Агент Алины', time: '09:03', text: 'Готово. Могу сразу превратить это в задачу или отредактировать текст.' }
  ], [
    {
      id: 'mission-support-1',
      goal: 'Разобрать входящий тикет и подготовить ответ',
      status: 'done',
      progress: 100,
      steps: [
        { title: 'Понять запрос', status: 'done' },
        { title: 'Проверить контекст', status: 'done' },
        { title: 'Собрать черновик', status: 'done' },
        { title: 'Отдать результат', status: 'done' }
      ],
      artifactId: 'artifact-support-1',
      createdAt: '09:04'
    }
  ], [
    { id: 'artifact-support-1', title: 'Черновик ответа клиенту', type: 'reply', summary: 'Короткий ответ по доступам с понятным следующим шагом.', content: 'Здравствуйте. Проверили доступы: учетная запись активна. Попробуйте войти заново, если ошибка повторится, пришлите скриншот и время попытки входа.' }
  ]),
  seedWorkspace('Дамир', 'approve', [
    'Найди свежую информацию в интернете',
    'Сгенерируй изображение для клиента',
    'Запусти поручение: подготовить follow-up',
    'Покажи статус поручений'
  ], [
    { id: 't3', title: 'Ответить клиенту по срокам', details: 'Сначала проверить подтвержденную дату', status: 'todo' },
    { id: 't4', title: 'Подготовить follow-up', details: 'Сделать короткий и уверенный текст', status: 'done' }
  ], [
    { id: 'm4', role: 'agent', author: 'Агент Дамира', time: '08:50', text: 'Я веду твое личное пространство. Здесь только твой чат, задачи и история.' },
    { id: 'm5', role: 'user', author: 'Дамир', time: '08:52', text: 'Сделай короткий ответ по прайсу и срокам.' },
    { id: 'm6', role: 'agent', author: 'Агент Дамира', time: '08:52', text: 'Ок, сначала проверяю подтвержденные сроки, потом дам черновик.' }
  ], [
    {
      id: 'mission-sales-1',
      goal: 'Подготовить follow-up клиенту',
      status: 'running',
      progress: 75,
      steps: [
        { title: 'Определить цель письма', status: 'done' },
        { title: 'Проверить прайс', status: 'done' },
        { title: 'Собрать черновик', status: 'running' },
        { title: 'Передать на подтверждение', status: 'todo' }
      ],
      artifactId: 'artifact-sales-1',
      createdAt: '08:55'
    }
  ], [
    { id: 'artifact-sales-1', title: 'Follow-up клиенту', type: 'draft', summary: 'Черновик письма по срокам и прайсу.', content: 'Добрый день. Подтверждаю актуальные сроки и стоимость. Готов прислать финальное предложение после вашего подтверждения объема.' }
  ])
];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      name text NOT NULL,
      title text NOT NULL,
      password text NOT NULL,
      agent_id text NOT NULL UNIQUE
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id text PRIMARY KEY,
      name text NOT NULL,
      title text NOT NULL,
      mode text NOT NULL,
      model text NOT NULL,
      quick_actions jsonb NOT NULL,
      tasks jsonb NOT NULL,
      messages jsonb NOT NULL,
      missions jsonb NOT NULL DEFAULT '[]'::jsonb,
      artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
      agent_config jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  `);
  await pool.query("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS missions jsonb NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS artifacts jsonb NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS agent_config jsonb NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_user_id text");
  await pool.query("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false");
  await pool.query('CREATE INDEX IF NOT EXISTS workspaces_owner_active_idx ON workspaces (owner_user_id, archived, name, id)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
  `);

  for (const user of seedUsers) {
    const passwordHash = hashPassword(user.password || crypto.randomBytes(32).toString('base64url'));
    await pool.query(`
      INSERT INTO users (id, name, title, password, agent_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          title = EXCLUDED.title,
          agent_id = EXCLUDED.agent_id
    `, [user.id, user.name, user.title, passwordHash, user.agentId]);
  }

  for (const workspace of seedWorkspaces) {
    const owner = seedUsers.find((user) => user.agentId === workspace.id);
    await pool.query(`
      INSERT INTO workspaces (id, name, title, mode, model, quick_actions, tasks, messages, missions, artifacts, agent_config, owner_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO NOTHING
    `, [
      workspace.id,
      workspace.name,
      workspace.title,
      workspace.mode,
      workspace.model,
      JSON.stringify(workspace.quickActions),
      JSON.stringify(workspace.tasks),
      JSON.stringify(workspace.messages),
      JSON.stringify(workspace.missions),
      JSON.stringify(workspace.artifacts),
      JSON.stringify(workspace.agentConfig),
      owner ? owner.id : null
    ]);
  }

  await pool.query("UPDATE workspaces SET model = 'Рабочий агент' WHERE model IS NULL OR model = ''");
  await pool.query('UPDATE workspaces SET quick_actions = $1 WHERE id = $2 AND jsonb_array_length(quick_actions) = 0', [
    JSON.stringify([
      'Найди свежую информацию в интернете',
      'Сгенерируй изображение для ответа',
      'Запусти поручение: разобрать тикет',
      'Покажи статус поручений'
    ]),
    'support-agent'
  ]);
  await pool.query('UPDATE workspaces SET quick_actions = $1 WHERE id = $2 AND jsonb_array_length(quick_actions) = 0', [
    JSON.stringify([
      'Найди свежую информацию в интернете',
      'Сгенерируй изображение для клиента',
      'Запусти поручение: подготовить follow-up',
      'Покажи статус поручений'
    ]),
    'sales-agent'
  ]);
  await pool.query("UPDATE workspaces SET agent_config = jsonb_build_object('name', '', 'role', '', 'instructions', '', 'setupDone', false) WHERE agent_config = '{}'::jsonb");
  await pool.query('UPDATE workspaces w SET owner_user_id = u.id FROM users u WHERE w.owner_user_id IS NULL AND u.agent_id = w.id');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const entries = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return null;
    let value = part.slice(idx + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      value = '';
    }
    return [part.slice(0, idx), value];
  }).filter(Boolean);
  return Object.fromEntries(entries);
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (FRONTEND_ORIGIN) return origin === FRONTEND_ORIGIN;
  const host = req.headers.host;
  if (!host) return false;
  return origin === 'http://' + host || origin === 'https://' + host;
}

function setCorsHeaders(req, res) {
  if (!FRONTEND_ORIGIN) return;
  if (!originAllowed(req)) return;
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendError(res, fallbackStatus, fallbackCode, error) {
  if (error && error.statusCode) {
    sendJson(res, error.statusCode, { error: error.message || fallbackCode });
    return;
  }
  sendJson(res, fallbackStatus, { error: fallbackCode });
}

function asyncHandler(req, res, handler) {
  Promise.resolve()
    .then(handler)
    .catch((error) => {
      console.error('Unhandled route error:', error);
      if (!res.headersSent && !res.writableEnded) {
        sendError(res, 500, 'server_error', error);
      } else if (!res.writableEnded) {
        res.end();
      }
    });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        failed = true;
        const error = new Error('request_body_too_large');
        error.statusCode = 413;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function safeJoin(root, requestPath) {
  const normalized = path.normalize(requestPath).replace(/^([./\\])+/, '');
  return path.join(root, normalized);
}

function now() {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function normalizeLogin(login) {
  const value = String(login || '').trim().toLowerCase();
  const aliases = {
    support: 'support',
    'алина': 'support',
    alina: 'support',
    sales: 'sales',
    'дамир': 'sales',
    damir: 'sales'
  };
  return aliases[value] || value;
}

async function getUserByLogin(login) {
  const normalized = normalizeLogin(login);
  const result = await pool.query('SELECT * FROM users WHERE lower(id) = $1 OR lower(name) = $1 LIMIT 1', [normalized]);
  return result.rows[0] || null;
}

async function getWorkspaceByAgentId(agentId) {
  const result = await pool.query('SELECT * FROM workspaces WHERE id = $1 LIMIT 1', [agentId]);
  return result.rows[0] || null;
}

async function getWorkspacesForUser(userId) {
  const result = await pool.query('SELECT * FROM workspaces WHERE owner_user_id = $1 AND archived = false ORDER BY name, id', [userId]);
  return result.rows.map(rowToWorkspace);
}

async function getWorkspaceForUser(user, workspaceId) {
  const explicitId = workspaceId !== undefined && workspaceId !== null && String(workspaceId).trim() !== '';
  const requestedId = String(explicitId ? workspaceId : user.agent_id || '').trim();
  if (requestedId) {
    const result = await pool.query('SELECT * FROM workspaces WHERE id = $1 AND owner_user_id = $2 AND archived = false LIMIT 1', [requestedId, user.id]);
    if (result.rows[0]) return result.rows[0];
    if (explicitId) {
      const error = new Error('workspace_not_found');
      error.statusCode = 404;
      throw error;
    }
  }
  const fallback = await pool.query('SELECT * FROM workspaces WHERE owner_user_id = $1 AND archived = false ORDER BY id = $2 DESC, name, id LIMIT 1', [user.id, user.agent_id]);
  return fallback.rows[0] || null;
}

function rowToWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    mode: row.mode,
    model: row.model,
    quickActions: row.quick_actions || [],
    tasks: row.tasks || [],
    messages: row.messages || [],
    missions: row.missions || [],
    artifacts: row.artifacts || [],
    ownerUserId: row.owner_user_id || null,
    agentConfig: row.agent_config || { name: '', role: '', instructions: '', setupDone: false }
  };
}

async function saveWorkspace(workspace) {
  await pool.query('UPDATE workspaces SET name = $1, title = $2, mode = $3, model = $4, quick_actions = $5, tasks = $6, messages = $7, missions = $8, artifacts = $9, agent_config = $10 WHERE id = $11', [
    workspace.name,
    workspace.title,
    workspace.mode,
    workspace.model,
    JSON.stringify(workspace.quickActions),
    JSON.stringify(workspace.tasks),
    JSON.stringify(workspace.messages),
    JSON.stringify(workspace.missions || []),
    JSON.stringify(workspace.artifacts || []),
    JSON.stringify(workspace.agentConfig || {}),
    workspace.id
  ]);
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}

function getAgentFiles(agentId) {
  const agentDir = path.join(AGENTS_DIR, agentId);
  return {
    dir: agentDir,
    soul: readTextFile(path.join(agentDir, 'SOUL.md')),
    user: readTextFile(path.join(agentDir, 'USER.md')),
    memory: readTextFile(path.join(agentDir, 'MEMORY.md')),
    workflow: readTextFile(path.join(agentDir, 'WORKFLOW.md'))
  };
}

function getGatewayModelForWorkspace(workspaceId) {
  const mapping = {
    'support-agent': 'openclaw/worker',
    'sales-agent': 'openclaw/pm'
  };
  return mapping[workspaceId] || 'openclaw/default';
}

async function createSession(userId, req, res) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [hashSessionToken(token), userId, expiresAt]);
  const cookieParts = [
    SESSION_COOKIE + '=' + token,
    'HttpOnly',
    'Path=/',
    'Max-Age=' + Math.floor(SESSION_TTL_MS / 1000),
    'SameSite=Lax'
  ];
  if (isSecureRequest(req)) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function loginThrottleKey(req, login) {
  return clientIp(req) + ':' + normalizeLogin(login || '');
}

function checkLoginThrottle(req, login) {
  const record = failedLogins.get(loginThrottleKey(req, login));
  if (record && record.lockedUntil > Date.now()) {
    const error = new Error('too_many_attempts');
    error.statusCode = 429;
    throw error;
  }
}

function recordLoginAttempt(req, login, ok) {
  const key = loginThrottleKey(req, login);
  if (ok) {
    failedLogins.delete(key);
    return;
  }
  const current = failedLogins.get(key) || { count: 0, lockedUntil: 0 };
  const count = current.count + 1;
  const lockedUntil = count >= 5 ? Date.now() + Math.min(15 * 60 * 1000, 30 * 1000 * (count - 4)) : 0;
  failedLogins.set(key, { count, lockedUntil });
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [hashSessionToken(token)]);
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const result = await pool.query(`
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1 AND s.expires_at > now()
    LIMIT 1
  `, [hashSessionToken(token)]);
  return result.rows[0] || null;
}

async function getAuthenticatedContext(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  const workspaceRow = await getWorkspaceForUser(user, req.headers['x-agent-id']);
  if (!workspaceRow) {
    sendJson(res, 404, { error: 'workspace_not_found' });
    return null;
  }
  const agents = await getWorkspacesForUser(user.id);
  return {
    user: { id: user.id, name: user.name, title: user.title, agentId: user.agent_id },
    workspace: rowToWorkspace(workspaceRow),
    agents: agents
  };
}

function addTask(workspace, title, details) {
  workspace.tasks.unshift({
    id: crypto.randomUUID(),
    title: title,
    details: details,
    status: 'todo'
  });
  workspace.tasks = workspace.tasks.slice(0, 12);
}

function addMessage(workspace, role, text, author, extra = {}) {
  workspace.messages.push({
    id: crypto.randomUUID(),
    role: role,
    author: author,
    time: now(),
    text: text,
    ...extra
  });
  workspace.messages = workspace.messages.slice(-50);
}

function defaultQuickActions() {
  return [
    'Найди свежую информацию в интернете',
    'Сгенерируй изображение',
    'Запусти поручение: подготовить результат',
    'Покажи статус поручений'
  ];
}

async function createWorkspaceForUser(user, body = {}) {
  const name = String(body.name || '').trim().slice(0, 80) || 'Новый агент';
  const role = String(body.role || '').trim().slice(0, 160);
  const instructions = String(body.instructions || '').trim().slice(0, 2000);
  const id = user.id + '-' + crypto.randomUUID();
  const workspace = {
    id: id,
    name: name,
    title: role || 'Личный рабочий агент',
    mode: 'approve',
    model: 'Рабочий агент',
    quickActions: defaultQuickActions(),
    tasks: [],
    messages: [],
    missions: [],
    artifacts: [],
    ownerUserId: user.id,
    agentConfig: {
      name: name,
      role: role,
      instructions: instructions,
      setupDone: Boolean(name || role || instructions)
    }
  };
  await pool.query('INSERT INTO workspaces (id, name, title, mode, model, quick_actions, tasks, messages, missions, artifacts, agent_config, owner_user_id, archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)', [
    workspace.id,
    workspace.name,
    workspace.title,
    workspace.mode,
    workspace.model,
    JSON.stringify(workspace.quickActions),
    JSON.stringify(workspace.tasks),
    JSON.stringify(workspace.messages),
    JSON.stringify(workspace.missions),
    JSON.stringify(workspace.artifacts),
    JSON.stringify(workspace.agentConfig),
    workspace.ownerUserId
  ]);
  return workspace;
}

function buildMissionFromGoal(goal) {
  const safeGoal = String(goal || '').trim() || 'Новое поручение помощнику';
  const artifactId = crypto.randomUUID();
  return {
    mission: {
      id: crypto.randomUUID(),
      goal: safeGoal,
      status: 'running',
      progress: 75,
      steps: [
        { title: 'Понять цель и ожидаемый результат', status: 'done' },
        { title: 'Разложить работу на шаги', status: 'done' },
        { title: 'Собрать рабочий черновик', status: 'running' },
        { title: 'Передать результат сотруднику', status: 'todo' }
      ],
      artifactId: artifactId,
      createdAt: now()
    },
    artifact: {
      id: artifactId,
      title: 'Рабочий результат: ' + safeGoal.slice(0, 48),
      type: 'mission',
      summary: 'Черновик результата, который агент подготовил по заданной цели.',
      content: 'Цель: ' + safeGoal + '\n\nПлан:\n1. Уточнить контекст.\n2. Выполнить проверку или подготовку.\n3. Собрать результат.\n4. Вернуть сотруднику готовый артефакт.'
    }
  };
}

function startMission(workspace, goal) {
  const result = buildMissionFromGoal(goal);
  workspace.missions = [result.mission, ...(workspace.missions || [])].slice(0, 8);
  workspace.artifacts = [result.artifact, ...(workspace.artifacts || [])].slice(0, 8);
  addTask(workspace, result.mission.goal, 'Создано как поручение помощнику с планом и готовым материалом.');
  return result;
}

function extractIntent(message) {
  const lower = String(message).toLowerCase();
  if (isImageRequest(lower)) return 'image';
  if (/поруч|мисси|mission|план|исслед|проанализ|подготов|автоном|manus/.test(lower)) return 'mission';
  if (/задач|task|сделай/.test(lower)) return 'task';
  if (/прайс|цена|документ|найди|поиск|интернет|web|сайт/.test(lower)) return 'search';
  if (/статус|блок|риск/.test(lower)) return 'status';
  if (/привет|hello|hi/.test(lower)) return 'greeting';
  return 'default';
}

function isImageRequest(message) {
  const lower = String(message || '').toLowerCase();
  if (/картин|изображ|иллюстрац|image|picture|photo|svg/.test(lower)) return true;
  return /(сгенер|генерир|нарису|рису|создай|сделай|generate|draw|create).*(кот|кота|кошк|cat|портрет|логотип|баннер|иконк)/.test(lower);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeDuckDuckGoUrl(value) {
  const raw = decodeHtml(value);
  try {
    const parsed = new URL(raw, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected || parsed.href;
  } catch {
    return raw;
  }
}

function searchQueryFromMessage(message) {
  return String(message || '')
    .replace(/найди|поищи|поиск|в интернете|интернет|web|сайт|свежую информацию|источник|источники/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchWeb(message) {
  const query = searchQueryFromMessage(message) || String(message || '').trim();
  if (!query) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const url = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AgentHub/1.0 (+https://github.com/devabalacom/ai)',
        'Accept-Language': 'ru,en;q=0.8'
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const results = [];
    const pattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/gi;
    let match;
    while ((match = pattern.exec(html)) && results.length < 5) {
      results.push({
        title: stripHtml(match[2]),
        url: normalizeDuckDuckGoUrl(match[1]),
        snippet: stripHtml(match[3] || match[4] || '')
      });
    }
    return results.length ? { query: query, results: results } : null;
  } catch (error) {
    console.warn('Web search failed:', error && error.message ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildSearchReply(message) {
  const found = await searchWeb(message);
  if (!found) {
    return 'Поиск включен, но сейчас не удалось получить результаты из внешней выдачи. Попробуй уточнить запрос или повторить позже.';
  }
  const lines = found.results.map((item, index) => {
    return (index + 1) + '. ' + item.title + '\n' + item.url + (item.snippet ? '\n' + item.snippet : '');
  });
  return 'Нашел свежие источники по запросу: ' + found.query + '\n\n' + lines.join('\n\n');
}

function buildImagePrompt(workspace, prompt, agentFiles) {
  const safePrompt = String(prompt || '').trim() || 'Рабочее изображение для задачи';
  const context = [
    agentFiles && agentFiles.soul ? 'Стиль агента: ' + agentFiles.soul.slice(0, 700) : '',
    workspace && workspace.agentConfig && workspace.agentConfig.instructions
      ? 'Настройки сотрудника: ' + workspace.agentConfig.instructions.slice(0, 500)
      : ''
  ].filter(Boolean).join('\n');
  return [
    'Создай готовое изображение по запросу сотрудника.',
    'Запрос: ' + safePrompt,
    context
  ].filter(Boolean).join('\n\n');
}

async function dataUrlFromImageUrl(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';
  return {
    content: Buffer.from(arrayBuffer).toString('base64'),
    mimeType: contentType.split(';')[0] || 'image/png'
  };
}

async function requestOpenAiImage(prompt) {
  if (!OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: prompt,
        size: OPENAI_IMAGE_SIZE,
        n: 1
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn('OpenAI image generation failed:', response.status, detail.slice(0, 500));
      return null;
    }
    const payload = await response.json();
    const image = payload && payload.data && payload.data[0];
    if (!image) return null;
    if (image.b64_json) {
      return { content: image.b64_json, mimeType: 'image/png' };
    }
    if (image.url) {
      return await dataUrlFromImageUrl(image.url);
    }
    return null;
  } catch (error) {
    console.warn('OpenAI image generation error:', error && error.message ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildImageArtifact(workspace, prompt, agentFiles) {
  const safePrompt = String(prompt || '').trim() || 'Рабочее изображение для задачи';
  const title = 'Изображение: ' + safePrompt.slice(0, 48);
  const generated = await requestOpenAiImage(buildImagePrompt(workspace, safePrompt, agentFiles));
  if (!generated || !generated.content) return null;
  const artifact = {
    id: crypto.randomUUID(),
    title: title,
    type: 'image',
    summary: 'Изображение, сгенерированное агентом по запросу сотрудника.',
    content: generated.content,
    contentEncoding: 'base64',
    mimeType: generated.mimeType || 'image/png',
    downloadName: title.replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) + '.png'
  };
  workspace.artifacts = [artifact, ...(workspace.artifacts || [])].slice(0, 8);
  return artifact;
}

function buildOpenClawPrompt(workspace, agentFiles, userText) {
  const agentConfig = workspace.agentConfig || {};
  return [
    agentFiles.soul || 'Ты личный рабочий агент сотрудника компании.',
    agentConfig.name ? 'Имя агента: ' + agentConfig.name : '',
    agentConfig.role ? 'Роль агента: ' + agentConfig.role : '',
    agentConfig.instructions ? 'Настройки сотрудника для агента:\n' + agentConfig.instructions : '',
    agentFiles.user ? 'Профиль сотрудника:\n' + agentFiles.user : '',
    agentFiles.workflow ? 'Workflow:\n' + agentFiles.workflow : '',
    agentFiles.memory ? 'Память:\n' + agentFiles.memory : '',
    'Текущий режим: ' + workspace.mode + '.',
    'Активные миссии: ' + JSON.stringify((workspace.missions || []).slice(0, 3)),
    'Последние артефакты: ' + JSON.stringify((workspace.artifacts || []).slice(0, 3).map(artifactPromptSummary)),
    'Доступные инструменты агента: поиск свежей информации в интернете и серверная генерация изображений через Images API. Если запрос требует внешних данных, явно используй интернет-поиск и кратко укажи источники. Если запрос требует визуала, не делай вид, что файл готов: реальный файл прикрепляет backend, а при недоступной генерации нужно честно сказать о настройке.',
    'Контекст изолирован: видишь только одного сотрудника и его workspace.',
    'Отвечай по-русски, коротко и по делу.',
    'Сообщение пользователя: ' + userText
  ].filter(Boolean).join('\n\n');
}

function getAgentDisplayName(workspace) {
  const agentConfig = workspace.agentConfig || {};
  return agentConfig.name || ('Агент ' + workspace.name);
}

function generateWorkflowReply(workspace, message, agentFiles) {
  const intent = extractIntent(message);
  const agentTone = agentFiles.soul
    ? 'Под капотом работает персональный рабочий агент.'
    : 'Под капотом работает персональный агент.';

  if (intent === 'task') {
    const title = String(message).replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    if (workspace.mode === 'execute' && !workspace.tasks.some((task) => task.title.toLowerCase() === title.toLowerCase())) {
      addTask(workspace, title, 'Создано из чата рабочего агента.');
    }
    if (workspace.mode === 'execute') return 'Готово: задача «' + title + '» добавлена. ' + agentTone;
    if (workspace.mode === 'approve') return 'Могу добавить задачу «' + title + '». Подтверди, если ок. ' + agentTone;
    return 'Могу оформить задачу «' + title + '» и добавить её в твое рабочее пространство. ' + agentTone;
  }

  if (intent === 'mission') {
    const goal = String(message).replace(/создай|запусти|поручение|поручений|миссию|mission|план|агента|manus/gi, '').trim() || message;
    if (workspace.mode !== 'execute') {
      if (workspace.mode === 'approve') return 'Могу запустить поручение «' + goal + '». Подтверди, если ок. ' + agentTone;
      return 'Могу оформить поручение «' + goal + '» с планом и готовым материалом. ' + agentTone;
    }
    const result = startMission(workspace, goal);
    return 'Запустил поручение: «' + result.mission.goal + '». Составил план, начал выполнение и положил черновик результата в “Готовые материалы”. ' + agentTone;
  }

  if (intent === 'search') {
    return 'Понял. У агента включен поиск в интернете: сначала проверю свежую информацию, потом верну короткий вывод и источники.';
  }

  if (intent === 'image') {
    return 'Принял. У этого агента включена генерация изображений: подготовлю промпт, стиль и результат как готовый материал.';
  }

  if (intent === 'status') {
    return 'Вижу текущий статус: ' + workspace.tasks.filter((task) => task.status !== 'done').length + ' открытых задач и ' + workspace.messages.length + ' сообщений в истории.';
  }

  if (intent === 'greeting') {
    if (workspace.mode === 'answer') return 'На связи. Пиши вопрос, задачу или короткую команду.';
    return 'Готов. Могу предложить шаги, оформить задачу или выполнить безопасный сценарий.';
  }

  if (workspace.mode === 'suggest') {
    return 'Сначала соберу контекст, потом предложу черновик и только затем действие.';
  }

  if (workspace.mode === 'execute') {
    return 'Выполняю безопасный сценарий и фиксирую результат в личном пространстве.';
  }

  return safeFallbackReply(workspace, intent);
}

function safeFallbackReply(workspace, intent) {
  if (intent === 'greeting') return 'Привет. Что нужно сделать?';
  if (intent === 'status') {
    return 'Вижу текущий статус: ' + workspace.tasks.filter((task) => task.status !== 'done').length + ' открытых задач и ' + workspace.messages.length + ' сообщений в истории.';
  }
  return 'Принял. Опиши нужный результат, и я помогу подготовить ответ, задачу или материал.';
}

function sanitizeAgentReply(reply, workspace, intent) {
  const text = String(reply || '').trim();
  if (!text) return safeFallbackReply(workspace, intent);
  if (/^#\s*Workflow/i.test(text) || /Прочитай сообщение сотрудника|Сначала пойми намерение|Workflow:/i.test(text)) {
    return safeFallbackReply(workspace, intent);
  }
  return text;
}

function toOpenAiMessages(workspace, userText, agentFiles) {
  const history = workspace.messages.slice(-16).map((message) => ({
    role: message.role === 'agent' ? 'assistant' : 'user',
    content: message.text
  }));

  return [
    { role: 'system', content: buildOpenClawPrompt(workspace, agentFiles, userText) },
    ...history,
    { role: 'user', content: userText }
  ];
}

function extractOpenClawText(payload) {
  const choice = payload && payload.choices && payload.choices[0];
  const content = choice && choice.message && choice.message.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => (part && part.text) || '').join('').trim();
  }
  return '';
}

async function askOpenClawGateway(workspace, userText, agentFiles) {
  if (!OPENCLAW_GATEWAY_URL) {
    if (!gatewayConfigWarned) {
      console.warn('OpenClaw gateway disabled: OPENCLAW_GATEWAY_URL is empty');
      gatewayConfigWarned = true;
    }
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  const headers = { 'Content-Type': 'application/json' };
  if (OPENCLAW_GATEWAY_TOKEN) {
    headers.Authorization = 'Bearer ' + OPENCLAW_GATEWAY_TOKEN;
  } else if (OPENCLAW_GATEWAY_PASSWORD) {
    headers.Authorization = 'Bearer ' + OPENCLAW_GATEWAY_PASSWORD;
  }

  try {
    const response = await fetch(OPENCLAW_GATEWAY_URL.replace(/\/$/, '') + '/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: headers,
      body: JSON.stringify({
        model: getGatewayModelForWorkspace(workspace.id),
        user: workspace.id,
        messages: toOpenAiMessages(workspace, userText, agentFiles),
        temperature: 0.4,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      console.warn('OpenClaw gateway request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const text = extractOpenClawText(data);
    return text || null;
  } catch (error) {
    console.warn('OpenClaw gateway request error:', error && error.message ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function answerWorkspaceMessage(workspace, userText, agentFiles) {
  const intent = extractIntent(userText);
  if (intent === 'search') return { text: await buildSearchReply(userText) };
  if (intent === 'image') {
    const artifact = await buildImageArtifact(workspace, userText, agentFiles);
    if (!artifact) {
      return {
        text: 'Не смог сгенерировать изображение: на сервере не настроена или недоступна генерация изображений. Нужен OPENAI_API_KEY с доступом к Images API.'
      };
    }
    return {
      text: 'Сгенерировал файл и прикрепил его в чат: ' + artifact.title + '. Его также можно найти в “Готовых материалах”.',
      artifact: artifact
    };
  }
  const reply = await askOpenClawGateway(workspace, userText, agentFiles);
  return { text: sanitizeAgentReply(reply || generateWorkflowReply(workspace, userText, agentFiles), workspace, intent) };
}

function tryWorkflowAction(workspace, text, reply) {
  const lower = String(text).toLowerCase();
  if (/поруч|мисси|mission|план|исслед|проанализ|подготов|manus/.test(lower)) return;
  if (!(/создай|сделай|задач|task/.test(lower))) return;
  if (!/добавлен|готово/.test(String(reply).toLowerCase())) return;
  const title = String(text).replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
  if (!workspace.tasks.some((task) => task.title.toLowerCase() === title.toLowerCase())) {
    addTask(workspace, title, 'Создано из чата рабочего агента.');
  }
}

async function handleMission(req, res) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  try {
    const body = await readBody(req);
    const goal = String(body.goal || '').trim();
    if (!goal) {
      sendJson(res, 400, { error: 'empty_goal' });
      return;
    }
    const result = startMission(ctx.workspace, goal);
    addMessage(ctx.workspace, 'agent', 'Запустил поручение: «' + result.mission.goal + '». План и материал уже доступны справа.', getAgentDisplayName(ctx.workspace));
    await saveWorkspace(ctx.workspace);
    sendJson(res, 200, { workspace: ctx.workspace, mission: result.mission, artifact: result.artifact });
  } catch (error) {
    console.error('Failed to handle /api/missions:', error);
    sendError(res, 500, 'mission_failed', error);
  }
}

async function handleAgentSettings(req, res) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  try {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 80);
    const role = String(body.role || '').trim().slice(0, 160);
    const instructions = String(body.instructions || '').trim().slice(0, 2000);
    if (name) ctx.workspace.name = name;
    ctx.workspace.title = role || 'Личный рабочий агент';
    ctx.workspace.agentConfig = {
      name: name,
      role: role,
      instructions: instructions,
      setupDone: Boolean(name || role || instructions)
    };
    await saveWorkspace(ctx.workspace);
    sendJson(res, 200, { workspace: ctx.workspace });
  } catch (error) {
    console.error('Failed to handle /api/agent-settings:', error);
    sendError(res, 500, 'agent_settings_failed', error);
  }
}

async function handleWorkspaceReset(req, res) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  ctx.workspace.tasks = [];
  ctx.workspace.messages = [];
  ctx.workspace.missions = [];
  ctx.workspace.artifacts = [];
  ctx.workspace.agentConfig = { name: '', role: '', instructions: '', setupDone: false };
  ctx.workspace.mode = 'approve';
  await saveWorkspace(ctx.workspace);
  sendJson(res, 200, { workspace: ctx.workspace });
}

async function handleAgents(req, res, agentId) {
  const user = await getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const agents = await getWorkspacesForUser(user.id);
      sendJson(res, 200, { agents: agents });
      return;
    }
    if (req.method === 'POST' && !agentId) {
      const body = await readBody(req);
      const workspace = await createWorkspaceForUser(user, body);
      const agents = await getWorkspacesForUser(user.id);
      sendJson(res, 200, { workspace: workspace, agents: agents });
      return;
    }
    if (req.method === 'DELETE' && agentId) {
      const agents = await getWorkspacesForUser(user.id);
      if (agents.length <= 1) {
        sendJson(res, 400, { error: 'last_agent_cannot_be_archived' });
        return;
      }
      const result = await pool.query('UPDATE workspaces SET archived = true WHERE id = $1 AND owner_user_id = $2 AND archived = false RETURNING id', [agentId, user.id]);
      if (!result.rows[0]) {
        sendJson(res, 404, { error: 'agent_not_found' });
        return;
      }
      const remaining = await getWorkspacesForUser(user.id);
      sendJson(res, 200, { agents: remaining, workspace: remaining[0] || null });
      return;
    }
    sendJson(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error('Failed to handle /api/agents:', error);
    sendError(res, 500, 'agents_failed', error);
  }
}

async function handleLogin(req, res) {
  try {
    const body = await readBody(req);
    checkLoginThrottle(req, body.login);
    const user = await getUserByLogin(body.login);
    const password = String(body.password || '');
    if (!user || !verifyPassword(password, user.password)) {
      recordLoginAttempt(req, body.login, false);
      sendJson(res, 401, { error: 'invalid_credentials' });
      return;
    }
    recordLoginAttempt(req, body.login, true);
    if (shouldUpgradePasswordHash(user.password)) {
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashPassword(password), user.id]);
    }
    await createSession(user.id, req, res);
    const workspace = await getWorkspaceForUser(user);
    const agents = await getWorkspacesForUser(user.id);
    sendJson(res, 200, {
      user: { id: user.id, name: user.name, title: user.title, agentId: user.agent_id },
      workspace: rowToWorkspace(workspace),
      agents: agents
    });
  } catch (error) {
    sendError(res, error.statusCode || 400, error.message || 'invalid_json', error);
  }
}

async function handleLogout(req, res) {
  await destroySession(req, res);
  sendJson(res, 200, { ok: true });
}

async function handleMessage(req, res) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  try {
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    if (!text) {
      sendJson(res, 400, { error: 'empty_message' });
      return;
    }
    addMessage(ctx.workspace, 'user', text, ctx.user.name);
    const agentFiles = getAgentFiles(ctx.workspace.id);
    const answer = await answerWorkspaceMessage(ctx.workspace, text, agentFiles);
    const reply = answer.text;
    tryWorkflowAction(ctx.workspace, text, reply);
    addMessage(ctx.workspace, 'agent', reply, getAgentDisplayName(ctx.workspace), answer.artifact ? { artifactId: answer.artifact.id } : {});
    ctx.workspace.model = WORKFLOW_PROVIDER === 'openclaw'
      ? getGatewayModelForWorkspace(ctx.workspace.id)
      : ctx.workspace.model;
    await saveWorkspace(ctx.workspace);
    sendJson(res, 200, { workspace: ctx.workspace, reply: reply });
  } catch (error) {
    console.error('Failed to handle /api/message:', error);
    sendError(res, 500, 'message_failed', error);
  }
}

async function handleMode(req, res) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  try {
    const body = await readBody(req);
    const mode = String(body.mode || '').trim();
    const allowed = new Set(['answer', 'suggest', 'approve', 'execute']);
    if (!allowed.has(mode)) {
      sendJson(res, 400, { error: 'invalid_mode' });
      return;
    }
    ctx.workspace.mode = mode;
    await saveWorkspace(ctx.workspace);
    sendJson(res, 200, { workspace: ctx.workspace });
  } catch (error) {
    sendError(res, 400, 'invalid_json', error);
  }
}

async function handleTasks(req, res, taskId) {
  const ctx = await getAuthenticatedContext(req, res);
  if (!ctx) return;
  try {
    const body = await readBody(req);
    if (req.method === 'POST') {
      const title = String(body.title || '').trim();
      if (!title) {
        sendJson(res, 400, { error: 'empty_title' });
        return;
      }
      const details = String(body.details || 'Создано вручную через панель.');
      addTask(ctx.workspace, title, details);
      await saveWorkspace(ctx.workspace);
      sendJson(res, 200, { workspace: ctx.workspace });
      return;
    }
    if (req.method === 'PATCH') {
      const status = String(body.status || '').trim();
      const allowed = new Set(['todo', 'waiting', 'done', 'blocked']);
      if (!allowed.has(status)) {
        sendJson(res, 400, { error: 'invalid_status' });
        return;
      }
      const task = ctx.workspace.tasks.find((item) => item.id === taskId);
      if (!task) {
        sendJson(res, 404, { error: 'task_not_found' });
        return;
      }
      task.status = status;
      await saveWorkspace(ctx.workspace);
      sendJson(res, 200, { workspace: ctx.workspace });
      return;
    }
    sendJson(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    sendError(res, 400, 'invalid_json', error);
  }
}

function serveStatic(res, pathname) {
  const targetPath = pathname === '/' ? '/index.html' : pathname;
  const publicFiles = new Set(['/index.html', '/app.js', '/styles.css', '/.nojekyll']);
  if (!publicFiles.has(targetPath)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  const filePath = safeJoin(ROOT, targetPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  res.writeHead(200, { 'Content-Type': mimeType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

async function main() {
  await initDb();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    setCorsHeaders(req, res);

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !originAllowed(req)) {
      sendJson(res, 403, { error: 'forbidden_origin' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        imageGenerationConfigured: Boolean(OPENAI_API_KEY)
      });
    }
    if (pathname === '/api/users' && req.method === 'GET') {
      asyncHandler(req, res, async () => {
        if (process.env.DEMO_USERS_PUBLIC !== 'true') {
          const user = await getSessionUser(req);
          if (!user) {
            sendJson(res, 401, { error: 'unauthorized' });
            return;
          }
        }
        const result = await pool.query('SELECT id, name, title, agent_id FROM users ORDER BY id');
        sendJson(res, 200, result.rows.map((row) => ({ id: row.id, name: row.name, title: row.title, agentId: row.agent_id })) );
      });
      return;
    }
    if (pathname === '/api/me' && req.method === 'GET') {
      asyncHandler(req, res, async () => {
        const ctx = await getAuthenticatedContext(req, res);
        if (!ctx) return;
        sendJson(res, 200, { user: ctx.user, workspace: ctx.workspace, agents: ctx.agents });
      });
      return;
    }
    if (pathname === '/api/login' && req.method === 'POST') { asyncHandler(req, res, () => handleLogin(req, res)); return; }
    if (pathname === '/api/logout' && req.method === 'POST') { asyncHandler(req, res, () => handleLogout(req, res)); return; }
    if (pathname === '/api/agents' && (req.method === 'GET' || req.method === 'POST')) { asyncHandler(req, res, () => handleAgents(req, res)); return; }
    const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch && req.method === 'DELETE') { asyncHandler(req, res, () => handleAgents(req, res, decodeURIComponent(agentMatch[1]))); return; }
    if (pathname === '/api/message' && req.method === 'POST') { asyncHandler(req, res, () => handleMessage(req, res)); return; }
    if (pathname === '/api/missions' && req.method === 'POST') { asyncHandler(req, res, () => handleMission(req, res)); return; }
    if (pathname === '/api/agent-settings' && req.method === 'POST') { asyncHandler(req, res, () => handleAgentSettings(req, res)); return; }
    if (pathname === '/api/workspace/reset' && req.method === 'POST') { asyncHandler(req, res, () => handleWorkspaceReset(req, res)); return; }
    if (pathname === '/api/workspace/mode' && req.method === 'POST') { asyncHandler(req, res, () => handleMode(req, res)); return; }
    if (pathname === '/api/tasks' && req.method === 'POST') { asyncHandler(req, res, () => handleTasks(req, res)); return; }
    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'PATCH') { asyncHandler(req, res, () => handleTasks(req, res, taskMatch[1])); return; }
    if (pathname.startsWith('/api/')) { sendJson(res, 404, { error: 'not_found' }); return; }
    serveStatic(res, pathname);
  });

  server.listen(PORT, () => {
    console.log('AgentHub backend listening on http://localhost:' + PORT);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
