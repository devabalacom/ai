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
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const WORKFLOW_PROVIDER = process.env.WORKFLOW_PROVIDER || 'openclaw';
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || '';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const OPENCLAW_GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD || '';
const AGENTS_DIR = path.join(ROOT, 'agents');

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const seedUsers = [
  { id: 'sergey', name: 'Сергей', title: 'Support lead', password: 'demo', agentId: 'sergey-agent' },
  { id: 'marina', name: 'Марина', title: 'Sales lead', password: 'demo', agentId: 'marina-agent' }
];

function seedWorkspace(userName, mode, quickActions, tasks, messages) {
  return {
    id: userName === 'Сергей' ? 'sergey-agent' : 'marina-agent',
    name: userName,
    title: 'Личный рабочий агент',
    mode: mode,
    model: 'OpenClaw workflow',
    quickActions: quickActions,
    tasks: tasks,
    messages: messages
  };
}

const seedWorkspaces = [
  seedWorkspace('Сергей', 'answer', [
    'Сделай черновик ответа',
    'Найди документ',
    'Создай задачу',
    'Покажи статус'
  ], [
    { id: 't1', title: 'Ответить на тикет по доступам', details: 'Подготовить короткий черновик ответа', status: 'todo' },
    { id: 't2', title: 'Собрать FAQ', details: 'Вытащить частые вопросы из истории', status: 'waiting' }
  ], [
    { id: 'm1', role: 'agent', author: 'Агент Сергея', time: '09:02', text: 'Я уже создан. Пиши сюда как в Telegram, API тебе не нужен.' },
    { id: 'm2', role: 'user', author: 'Сергей', time: '09:03', text: 'Сделай черновик ответа на тикет по доступам.' },
    { id: 'm3', role: 'agent', author: 'Агент Сергея', time: '09:03', text: 'Готово. Могу сразу превратить это в задачу или отредактировать текст.' }
  ]),
  seedWorkspace('Марина', 'suggest', [
    'Составь ответ клиенту',
    'Проверь прайс',
    'Сделай follow-up',
    'Создай задачу'
  ], [
    { id: 't3', title: 'Ответить клиенту по срокам', details: 'Сначала проверить подтвержденную дату', status: 'todo' },
    { id: 't4', title: 'Подготовить follow-up', details: 'Сделать короткий и уверенный текст', status: 'done' }
  ], [
    { id: 'm4', role: 'agent', author: 'Агент Марины', time: '08:50', text: 'Я веду твой личный workspace. Здесь только твой чат, задачи и история.' },
    { id: 'm5', role: 'user', author: 'Марина', time: '08:52', text: 'Сделай короткий ответ по прайсу и срокам.' },
    { id: 'm6', role: 'agent', author: 'Агент Марины', time: '08:52', text: 'Ок, сначала проверяю подтвержденные сроки, потом дам черновик.' }
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
      messages jsonb NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
  `);

  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (existing.rows[0].count === 0) {
    for (const user of seedUsers) {
      await pool.query('INSERT INTO users (id, name, title, password, agent_id) VALUES ($1, $2, $3, $4, $5)', [
        user.id, user.name, user.title, user.password, user.agentId
      ]);
    }
    for (const workspace of seedWorkspaces) {
      await pool.query('INSERT INTO workspaces (id, name, title, mode, model, quick_actions, tasks, messages) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
        workspace.id,
        workspace.name,
        workspace.title,
        workspace.mode,
        workspace.model,
        JSON.stringify(workspace.quickActions),
        JSON.stringify(workspace.tasks),
        JSON.stringify(workspace.messages)
      ]);
    }
  }

  await pool.query("UPDATE workspaces SET model = 'OpenClaw workflow' WHERE model IS DISTINCT FROM 'OpenClaw workflow'");
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const entries = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return null;
    return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
  }).filter(Boolean);
  return Object.fromEntries(entries);
}

function setCorsHeaders(res) {
  if (!FRONTEND_ORIGIN) return;
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
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
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function normalizeLogin(login) {
  const value = String(login || '').trim().toLowerCase();
  const aliases = {
    sergey: 'sergey',
    'сергей': 'sergey',
    marina: 'marina',
    'марина': 'marina'
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

function rowToWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    mode: row.mode,
    model: row.model,
    quickActions: row.quick_actions || [],
    tasks: row.tasks || [],
    messages: row.messages || []
  };
}

async function saveWorkspace(workspace) {
  await pool.query('UPDATE workspaces SET name = $1, title = $2, mode = $3, model = $4, quick_actions = $5, tasks = $6, messages = $7 WHERE id = $8', [
    workspace.name,
    workspace.title,
    workspace.mode,
    workspace.model,
    JSON.stringify(workspace.quickActions),
    JSON.stringify(workspace.tasks),
    JSON.stringify(workspace.messages),
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

async function createSession(userId, res) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);
  const cookieParts = [
    SESSION_COOKIE + '=' + token,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax'
  ];
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
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
  `, [token]);
  return result.rows[0] || null;
}

async function getAuthenticatedContext(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  const workspaceRow = await getWorkspaceByAgentId(user.agent_id);
  if (!workspaceRow) {
    sendJson(res, 404, { error: 'workspace_not_found' });
    return null;
  }
  return {
    user: { id: user.id, name: user.name, title: user.title, agentId: user.agent_id },
    workspace: rowToWorkspace(workspaceRow)
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

function addMessage(workspace, role, text, author) {
  workspace.messages.push({
    id: crypto.randomUUID(),
    role: role,
    author: author,
    time: now(),
    text: text
  });
  workspace.messages = workspace.messages.slice(-50);
}

function extractIntent(message) {
  const lower = String(message).toLowerCase();
  if (/задач|task|сделай/.test(lower)) return 'task';
  if (/прайс|цена|документ|найди|поиск/.test(lower)) return 'search';
  if (/статус|блок|риск/.test(lower)) return 'status';
  if (/привет|hello|hi/.test(lower)) return 'greeting';
  return 'default';
}

function buildOpenClawPrompt(workspace, agentFiles, userText) {
  return [
    agentFiles.soul || 'Ты личный рабочий агент сотрудника компании.',
    agentFiles.user ? 'Профиль сотрудника:\n' + agentFiles.user : '',
    agentFiles.workflow ? 'Workflow:\n' + agentFiles.workflow : '',
    agentFiles.memory ? 'Память:\n' + agentFiles.memory : '',
    'Текущий режим: ' + workspace.mode + '.',
    'Контекст изолирован: видишь только одного сотрудника и его workspace.',
    'Отвечай по-русски, коротко и по делу.',
    'Сообщение пользователя: ' + userText
  ].filter(Boolean).join('\n\n');
}

function generateWorkflowReply(workspace, message, agentFiles) {
  const intent = extractIntent(message);
  const agentTone = agentFiles.soul
    ? 'Под капотом работает персональный агент через OpenClaw workflow.'
    : 'Под капотом работает персональный workflow-агент.';

  if (intent === 'task') {
    const title = String(message).replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    if (!workspace.tasks.some((task) => task.title.toLowerCase() === title.toLowerCase())) {
      addTask(workspace, title, 'Создано из чата OpenClaw workflow.');
    }
    if (workspace.mode === 'execute') return 'Готово: задача «' + title + '» добавлена. ' + agentTone;
    if (workspace.mode === 'approve') return 'Могу добавить задачу «' + title + '». Подтверди, если ок. ' + agentTone;
    return 'Могу оформить задачу «' + title + '» и добавить её в твой workflow. ' + agentTone;
  }

  if (intent === 'search') {
    return 'Понял. Ищу релевантный документ, прайс или шаблон в личной базе этого агента.';
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
    return 'Выполняю безопасный сценарий и фиксирую результат в текущем workspace.';
  }

  return agentFiles.workflow || 'Принял. Веду личный workspace сотрудника: чат, задачи и workflow.';
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
  if (!OPENCLAW_GATEWAY_URL) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
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
        model: 'openclaw/default',
        user: workspace.id,
        messages: toOpenAiMessages(workspace, userText, agentFiles),
        temperature: 0.4,
        max_tokens: 400
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = extractOpenClawText(data);
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function tryWorkflowAction(workspace, text, reply) {
  const lower = String(text).toLowerCase();
  if (!(/создай|сделай|задач|task/.test(lower))) return;
  if (!/добавлен|готово|могу/.test(String(reply).toLowerCase())) return;
  const title = String(text).replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
  if (!workspace.tasks.some((task) => task.title.toLowerCase() === title.toLowerCase())) {
    addTask(workspace, title, 'Создано из чата OpenClaw workflow.');
  }
}

async function handleLogin(req, res) {
  try {
    const body = await readBody(req);
    const user = await getUserByLogin(body.login);
    const password = String(body.password || '');
    if (!user || user.password !== password) {
      sendJson(res, 401, { error: 'invalid_credentials' });
      return;
    }
    await createSession(user.id, res);
    const workspace = await getWorkspaceByAgentId(user.agent_id);
    sendJson(res, 200, {
      user: { id: user.id, name: user.name, title: user.title, agentId: user.agent_id },
      workspace: rowToWorkspace(workspace)
    });
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
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
    const reply = (await askOpenClawGateway(ctx.workspace, text, agentFiles)) || generateWorkflowReply(ctx.workspace, text, agentFiles);
    tryWorkflowAction(ctx.workspace, text, reply);
    addMessage(ctx.workspace, 'agent', reply, 'Агент ' + ctx.workspace.name);
    ctx.workspace.model = WORKFLOW_PROVIDER === 'openclaw' ? 'OpenClaw workflow' : ctx.workspace.model;
    await saveWorkspace(ctx.workspace);
    sendJson(res, 200, { workspace: ctx.workspace, reply: reply });
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
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
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
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
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
  }
}

function serveStatic(res, pathname) {
  const targetPath = pathname === '/' ? '/index.html' : pathname;
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
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });
    if (pathname === '/api/users' && req.method === 'GET') {
      pool.query('SELECT id, name, title, agent_id FROM users ORDER BY id').then((result) => {
        sendJson(res, 200, result.rows.map((row) => ({ id: row.id, name: row.name, title: row.title, agentId: row.agent_id })) );
      }).catch(() => sendJson(res, 500, { error: 'db_error' }));
      return;
    }
    if (pathname === '/api/me' && req.method === 'GET') {
      getAuthenticatedContext(req, res).then((ctx) => {
        if (!ctx) return;
        sendJson(res, 200, { user: ctx.user, workspace: ctx.workspace });
      }).catch(() => sendJson(res, 500, { error: 'db_error' }));
      return;
    }
    if (pathname === '/api/login' && req.method === 'POST') { handleLogin(req, res); return; }
    if (pathname === '/api/logout' && req.method === 'POST') { handleLogout(req, res); return; }
    if (pathname === '/api/message' && req.method === 'POST') { handleMessage(req, res); return; }
    if (pathname === '/api/workspace/mode' && req.method === 'POST') { handleMode(req, res); return; }
    if (pathname === '/api/tasks' && req.method === 'POST') { handleTasks(req, res); return; }
    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'PATCH') { handleTasks(req, res, taskMatch[1]); return; }
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
