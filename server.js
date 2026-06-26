const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const STATE_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const SESSION_COOKIE = 'agenthub_session';

const demoUsers = [
  { id: 'sergey', name: 'Сергей', title: 'Support lead', password: 'demo', agentId: 'sergey-agent' },
  { id: 'marina', name: 'Марина', title: 'Sales lead', password: 'demo', agentId: 'marina-agent' }
];

function seedState() {
  return {
    users: demoUsers,
    workspaces: {
      'sergey-agent': {
        id: 'sergey-agent',
        name: 'Сергей',
        title: 'Личный рабочий агент',
        mode: 'answer',
        model: 'GPT-5',
        quickActions: ['Сделай черновик ответа', 'Найди документ', 'Создай задачу', 'Покажи статус'],
        tasks: [
          { id: 't1', title: 'Ответить на тикет по доступам', details: 'Подготовить короткий черновик ответа', status: 'todo' },
          { id: 't2', title: 'Собрать FAQ', details: 'Вытащить частые вопросы из истории', status: 'waiting' }
        ],
        messages: [
          { id: 'm1', role: 'agent', author: 'Агент Сергея', time: '09:02', text: 'Я уже создан. Пиши сюда как в Telegram, API тебе не нужен.' },
          { id: 'm2', role: 'user', author: 'Сергей', time: '09:03', text: 'Сделай черновик ответа на тикет по доступам.' },
          { id: 'm3', role: 'agent', author: 'Агент Сергея', time: '09:03', text: 'Готово. Могу сразу превратить это в задачу или отредактировать текст.' }
        ]
      },
      'marina-agent': {
        id: 'marina-agent',
        name: 'Марина',
        title: 'Личный рабочий агент',
        mode: 'suggest',
        model: 'GPT-5',
        quickActions: ['Составь ответ клиенту', 'Проверь прайс', 'Сделай follow-up', 'Создай задачу'],
        tasks: [
          { id: 't3', title: 'Ответить клиенту по срокам', details: 'Сначала проверить подтвержденную дату', status: 'todo' },
          { id: 't4', title: 'Подготовить follow-up', details: 'Сделать короткий и уверенный текст', status: 'done' }
        ],
        messages: [
          { id: 'm4', role: 'agent', author: 'Агент Марины', time: '08:50', text: 'Я веду твой личный workspace. Здесь только твой чат, задачи и история.' },
          { id: 'm5', role: 'user', author: 'Марина', time: '08:52', text: 'Сделай короткий ответ по прайсу и срокам.' },
          { id: 'm6', role: 'agent', author: 'Агент Марины', time: '08:52', text: 'Ок, сначала проверяю подтвержденные сроки, потом дам черновик.' }
        ]
      }
    }
  };
}

function ensureStateFile() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(seedState(), null, 2));
  }
}

function loadState() {
  ensureStateFile();
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users || !parsed.workspaces) throw new Error('Invalid state file');
    return parsed;
  } catch {
    const fresh = seedState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

let state = loadState();
const sessions = new Map();

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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

function getPublicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, title: user.title, agentId: user.agentId };
}

function getWorkspaceForUser(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return null;
  return state.workspaces[user.agentId] || null;
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map((part) => {
    const pieces = part.trim().split('=');
    const key = pieces.shift();
    return [key, decodeURIComponent(pieces.join('='))];
  }).filter(([key]) => key));
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return state.users.find((item) => item.id === userId) || null;
}

function setSession(res, userId) {
  const token = crypto.randomUUID();
  sessions.set(token, userId);
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + token + '; HttpOnly; Path=/; SameSite=Lax');
}

function clearSession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
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

function addTask(workspace, title, details) {
  workspace.tasks.unshift({
    id: crypto.randomUUID(),
    title,
    details,
    status: 'todo'
  });
  workspace.tasks = workspace.tasks.slice(0, 12);
}

function addMessage(workspace, role, text, author) {
  workspace.messages.push({
    id: crypto.randomUUID(),
    role,
    author,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    text
  });
  workspace.messages = workspace.messages.slice(-50);
}

function generateReply(workspace, message) {
  const lower = String(message).toLowerCase();

  if (/задач|task|сделай/.test(lower)) {
    const title = String(message).replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    addTask(workspace, title, 'Создано из чата.');
    if (workspace.mode === 'execute') return 'Готово: задача «' + title + '» добавлена.';
    return 'Могу добавить задачу «' + title + '». Подтверди, если ок.';
  }

  if (/прайс|цена|документ|найди|поиск/.test(lower)) {
    return 'Понял. В этом MVP я найду релевантный шаблон, прайс или документ в личной базе.';
  }

  if (/статус|блок|риск/.test(lower)) {
    return 'Вижу текущий статус: есть открытые задачи и один блокер, если он есть в твоей очереди.';
  }

  if (/привет|hello|hi/.test(lower)) {
    if (workspace.mode === 'answer') return 'На связи. Пиши вопрос, задачу или короткую команду.';
    return 'Готов. Могу предложить решение, спланировать шаги или выполнить безопасный сценарий.';
  }

  if (workspace.mode === 'suggest') {
    return 'Сначала соберу контекст, потом предложу черновик и только затем действие.';
  }

  if (workspace.mode === 'execute') {
    return 'Выполняю безопасный сценарий и фиксирую результат в текущем workspace.';
  }

  return 'Принял. Могу отвечать, искать, создавать задачи и вести твой личный workflow.';
}

function getAuthenticatedContext(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  const workspace = getWorkspaceForUser(user.id);
  if (!workspace) {
    sendJson(res, 404, { error: 'workspace_not_found' });
    return null;
  }
  return { user, workspace };
}

function handleLogin(req, res) {
  readBody(req).then((body) => {
    const login = normalizeLogin(body.login);
    const password = String(body.password || '');
    const user = state.users.find((item) => item.id === login || item.name.toLowerCase() === login);
    if (!user || user.password !== password) {
      sendJson(res, 401, { error: 'invalid_credentials' });
      return;
    }
    setSession(res, user.id);
    sendJson(res, 200, { user: getPublicUser(user), workspace: state.workspaces[user.agentId] });
  }).catch(() => sendJson(res, 400, { error: 'invalid_json' }));
}

function handleLogout(req, res) {
  clearSession(req, res);
  sendJson(res, 200, { ok: true });
}

function handleMessage(req, res) {
  const ctx = getAuthenticatedContext(req, res);
  if (!ctx) return;

  readBody(req).then((body) => {
    const text = String(body.text || '').trim();
    if (!text) {
      sendJson(res, 400, { error: 'empty_message' });
      return;
    }

    addMessage(ctx.workspace, 'user', text, ctx.user.name);
    const reply = generateReply(ctx.workspace, text);
    addMessage(ctx.workspace, 'agent', reply, 'Агент ' + ctx.workspace.name);
    saveState();
    sendJson(res, 200, { workspace: ctx.workspace, reply });
  }).catch(() => sendJson(res, 400, { error: 'invalid_json' }));
}

function handleMode(req, res) {
  const ctx = getAuthenticatedContext(req, res);
  if (!ctx) return;

  readBody(req).then((body) => {
    const mode = String(body.mode || '').trim();
    const allowed = new Set(['answer', 'suggest', 'approve', 'execute']);
    if (!allowed.has(mode)) {
      sendJson(res, 400, { error: 'invalid_mode' });
      return;
    }
    ctx.workspace.mode = mode;
    saveState();
    sendJson(res, 200, { workspace: ctx.workspace });
  }).catch(() => sendJson(res, 400, { error: 'invalid_json' }));
}

function handleTasks(req, res, taskId) {
  const ctx = getAuthenticatedContext(req, res);
  if (!ctx) return;

  if (req.method === 'POST') {
    readBody(req).then((body) => {
      const title = String(body.title || '').trim();
      if (!title) {
        sendJson(res, 400, { error: 'empty_title' });
        return;
      }
      const details = String(body.details || 'Создано вручную через панель.');
      addTask(ctx.workspace, title, details);
      saveState();
      sendJson(res, 200, { workspace: ctx.workspace });
    }).catch(() => sendJson(res, 400, { error: 'invalid_json' }));
    return;
  }

  if (req.method === 'PATCH') {
    readBody(req).then((body) => {
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
      saveState();
      sendJson(res, 200, { workspace: ctx.workspace });
    }).catch(() => sendJson(res, 400, { error: 'invalid_json' }));
    return;
  }

  sendJson(res, 405, { error: 'method_not_allowed' });
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    sendJson(res, 200, state.users.map(getPublicUser));
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    const ctx = getAuthenticatedContext(req, res);
    if (!ctx) return;
    sendJson(res, 200, { user: getPublicUser(ctx.user), workspace: ctx.workspace });
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    handleLogin(req, res);
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    handleLogout(req, res);
    return;
  }

  if (pathname === '/api/message' && req.method === 'POST') {
    handleMessage(req, res);
    return;
  }

  if (pathname === '/api/workspace/mode' && req.method === 'POST') {
    handleMode(req, res);
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'POST') {
    handleTasks(req, res);
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    handleTasks(req, res, taskMatch[1]);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  serveStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log('AgentHub backend listening on http://localhost:' + PORT);
});
