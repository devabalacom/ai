const STORAGE_KEY = 'agenthub-client-state-v2';
const API_BASE = (window.AGENTHUB_API_BASE || '').replace(/\/$/, '');
const TIME_ZONE = 'Europe/Moscow';

const demoUsers = [
  { id: 'sergey', name: 'Сергей', title: 'Support lead', password: 'demo', agentId: 'sergey-agent' },
  { id: 'marina', name: 'Марина', title: 'Sales lead', password: 'demo', agentId: 'marina-agent' }
];

const fallbackWorkspaces = {
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
};

const state = {
  apiAvailable: false,
  currentUser: null,
  workspace: null,
  users: demoUsers,
  localWorkspaces: structuredClone(fallbackWorkspaces),
  pendingTask: false,
  sendingMessage: false
};

const el = {
  authCard: document.getElementById('auth-card'),
  dashboard: document.getElementById('dashboard'),
  loginForm: document.getElementById('login-form'),
  userSelect: document.getElementById('user-select'),
  password: document.getElementById('password'),
  demoFill: document.getElementById('demo-fill'),
  logoutBtn: document.getElementById('logout-btn'),
  profileName: document.getElementById('profile-name'),
  profileMeta: document.getElementById('profile-meta'),
  workspaceTitle: document.getElementById('workspace-title'),
  workspaceHint: document.getElementById('workspace-hint'),
  modelLabel: document.getElementById('model-label'),
  modeLabel: document.getElementById('mode-label'),
  taskCount: document.getElementById('task-count'),
  chatSubtitle: document.getElementById('chat-subtitle'),
  modeSwitch: document.getElementById('mode-switch'),
  quickActions: document.getElementById('quick-actions'),
  messages: document.getElementById('messages'),
  composer: document.getElementById('composer'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  taskList: document.getElementById('task-list'),
  workflowGrid: document.getElementById('workflow-grid'),
  newTaskBtn: document.getElementById('new-task-btn'),
  promptModal: document.getElementById('prompt-modal'),
  promptTitle: document.getElementById('prompt-title'),
  promptLabel: document.getElementById('prompt-label'),
  promptInput: document.getElementById('prompt-input')
};

function persistLocal() {
  if (state.apiAvailable) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentUserId: state.currentUser?.id ?? null,
    workspaces: state.localWorkspaces
  }));
}

function restoreLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved?.workspaces) state.localWorkspaces = saved.workspaces;
    if (saved?.currentUserId) {
      state.currentUser = state.users.find((user) => user.id === saved.currentUserId) ?? null;
      state.workspace = state.currentUser ? state.localWorkspaces[state.currentUser.agentId] ?? null : null;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function recoverUnauthorized() {
  state.currentUser = null;
  state.workspace = null;
  state.sendingMessage = false;
  state.pendingTask = false;
  if (el.authCard && el.dashboard) render();
}

async function apiRequest(path, options = {}) {
  const { allowUnauthorized = false, headers = {}, ...fetchOptions } = options;
  const url = API_BASE ? API_BASE + path : path;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...fetchOptions
  });

  if (!response.ok) {
    const error = new Error('Request failed');
    error.status = response.status;
    if (response.status === 401 && !allowUnauthorized) recoverUnauthorized();
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function currentWorkspace() {
  return state.workspace || (state.currentUser ? state.localWorkspaces[state.currentUser.agentId] : null);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function now() {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function scrollMessagesToBottom() {
  requestAnimationFrame(() => {
    el.messages.scrollTop = el.messages.scrollHeight;
  });
}

function statusBadge(status) {
  const safeStatus = escapeHtml(status);
  return `<span class="badge ${safeStatus}">${safeStatus}</span>`;
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  el.authCard.classList.toggle('hidden', loggedIn);
  el.dashboard.classList.toggle('hidden', !loggedIn);
}

function renderUserSelect() {
  const selected = el.userSelect.value;
  const options = state.users.map((user) => {
    const option = document.createElement('option');
    option.value = String(user.id);
    option.textContent = `${user.name} · ${user.title}`;
    return option;
  });
  el.userSelect.replaceChildren(...options);
  if (state.users.some((user) => String(user.id) === selected)) {
    el.userSelect.value = selected;
  } else if (state.users[0]) {
    el.userSelect.value = String(state.users[0].id);
  }
}

function renderWorkspace() {
  const workspace = currentWorkspace();
  if (!state.currentUser || !workspace) return;

  el.sendBtn.disabled = state.sendingMessage;
  el.sendBtn.textContent = state.sendingMessage ? 'Отправляем…' : 'Отправить';

  el.profileName.textContent = state.currentUser.name;
  el.profileMeta.textContent = `${state.currentUser.title} · личное пространство`;
  el.workspaceTitle.textContent = `${workspace.name} · ${workspace.title}`;
  el.workspaceHint.textContent = 'Сотрудник видит только свой чат, свои задачи и свой workflow.';
  el.modelLabel.textContent = workspace.model;
  el.modeLabel.textContent = workspace.mode;
  el.taskCount.textContent = String(workspace.tasks.filter((task) => task.status !== 'done').length);
  el.chatSubtitle.textContent = 'Личный чат сотрудника и его агента.';

  const modes = ['answer', 'suggest', 'approve', 'execute'];
  el.modeSwitch.innerHTML = modes.map((mode) => `
    <button class="mode-chip ${mode === workspace.mode ? 'active' : ''}" data-mode="${mode}" type="button">${mode}</button>
  `).join('');

  el.quickActions.innerHTML = workspace.quickActions.map((item) => `
    <button class="quick-chip" type="button" data-quick="${escapeHtml(item)}">${escapeHtml(item)}</button>
  `).join('');

  el.messages.innerHTML = workspace.messages.map((message) => `
    <article class="message ${escapeHtml(message.role)}">
      <div class="message-meta">
        <span>${escapeHtml(message.author)}</span>
        <span>${escapeHtml(message.time)}</span>
      </div>
      <div>${escapeHtml(message.text)}</div>
    </article>
  `).join('');
  scrollMessagesToBottom();

  el.taskList.innerHTML = workspace.tasks.map((task) => `
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="panel-subtitle">${escapeHtml(task.details)}</div>
        </div>
        ${statusBadge(task.status)}
      </div>
      <div class="task-actions">
        <button type="button" data-task-status="todo" data-task-id="${escapeHtml(task.id)}">Todo</button>
        <button type="button" data-task-status="waiting" data-task-id="${escapeHtml(task.id)}">Waiting</button>
        <button type="button" data-task-status="done" data-task-id="${escapeHtml(task.id)}">Done</button>
      </div>
    </div>
  `).join('');

  const workflow = [
    { label: 'Current mode', value: workspace.mode },
    { label: 'Open tasks', value: String(workspace.tasks.filter((task) => task.status !== 'done').length) },
    { label: 'Chat history', value: String(workspace.messages.length) },
    { label: 'Agent', value: workspace.name }
  ];

  el.workflowGrid.innerHTML = workflow.map((item) => `
    <div class="workflow-card">
      <div class="workflow-label">${escapeHtml(item.label)}</div>
      <div class="workflow-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');
}

function render() {
  if (!state.currentUser) {
    renderUserSelect();
    renderAuthState();
    return;
  }

  renderAuthState();
  renderWorkspace();
  persistLocal();
}

function addLocalMessage(workspace, role, text, author) {
  workspace.messages.push({ id: newId(), role, author, time: now(), text });
  workspace.messages = workspace.messages.slice(-50);
}

function addLocalTask(workspace, title, details) {
  workspace.tasks.unshift({ id: newId(), title, details, status: 'todo' });
  workspace.tasks = workspace.tasks.slice(0, 12);
}

function generateReply(workspace, message) {
  const lower = message.toLowerCase();

  if (/задач|task|сделай/.test(lower)) {
    const title = message.replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    addLocalTask(workspace, title, 'Создано из чата.');
    return workspace.mode === 'execute'
      ? `Готово: задача «${title}» добавлена.`
      : `Могу добавить задачу «${title}». Подтверди, если ок.`;
  }

  if (/прайс|цена|документ|найди|поиск/.test(lower)) {
    return 'Понял. В этом MVP я найду релевантный шаблон, прайс или документ в личной базе.';
  }

  if (/статус|блок|риск/.test(lower)) {
    return 'Вижу текущий статус: есть открытые задачи и один блокер, если он есть в твоей очереди.';
  }

  if (/привет|hello|hi/.test(lower)) {
    return workspace.mode === 'answer'
      ? 'На связи. Пиши вопрос, задачу или короткую команду.'
      : 'Готов. Могу предложить решение, спланировать шаги или выполнить безопасный сценарий.';
  }

  if (workspace.mode === 'suggest') {
    return 'Сначала соберу контекст, потом предложу черновик и только затем действие.';
  }

  if (workspace.mode === 'execute') {
    return 'Выполняю безопасный сценарий и фиксирую результат в текущем workspace.';
  }

  return 'Принял. Могу отвечать, искать, создавать задачи и вести твой личный workflow.';
}

async function detectBackend() {
  try {
    const response = await fetch((API_BASE ? API_BASE : '') + '/api/health', { cache: 'no-store', credentials: 'include' });
    state.apiAvailable = response.ok;
  } catch {
    state.apiAvailable = false;
  }
}

async function loadUsers() {
  if (state.apiAvailable) {
    try {
      state.users = await apiRequest('/api/users');
      return;
    } catch {
      state.apiAvailable = false;
    }
  }
  state.users = demoUsers;
}

async function loadSession() {
  if (state.apiAvailable) {
    try {
      const me = await apiRequest('/api/me', { allowUnauthorized: true });
      state.currentUser = me.user;
      state.workspace = me.workspace;
      return Boolean(state.currentUser && state.workspace);
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }

  restoreLocal();
  return Boolean(state.currentUser && state.workspace);
}

async function loginUser(login, password) {
  if (state.apiAvailable) {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    state.currentUser = result.user;
    state.workspace = result.workspace;
    return;
  }

  const user = demoUsers.find((item) => item.id === login);
  if (!user || user.password !== password) throw new Error('invalid_credentials');
  state.currentUser = user;
  state.workspace = structuredClone(state.localWorkspaces[user.agentId]);
  persistLocal();
}

async function logoutUser() {
  if (state.apiAvailable) {
    try {
      await apiRequest('/api/logout', { method: 'POST', body: '{}' });
    } catch {
      // ignore
    }
  }
  state.currentUser = null;
  state.workspace = null;
  if (!state.apiAvailable) localStorage.removeItem(STORAGE_KEY);
  render();
}

async function setWorkspaceMode(mode) {
  if (!state.currentUser) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/workspace/mode', {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    workspace.mode = mode;
    state.workspace = workspace;
    persistLocal();
  }
  render();
}

async function sendMessage(text) {
  if (!state.currentUser) return;
  if (state.sendingMessage) return;
  const safeText = String(text || '').trim();
  if (!safeText) return;
  state.sendingMessage = true;
  render();
  const previousText = el.messageInput.value;
  const workspace = currentWorkspace();

  if (workspace) {
    addLocalMessage(workspace, 'user', safeText, state.currentUser.name);
    render();
  }

  try {
    if (state.apiAvailable) {
      const result = await apiRequest('/api/message', {
        method: 'POST',
        body: JSON.stringify({ text: safeText })
      });
      state.workspace = result.workspace;
    } else if (workspace) {
      const reply = generateReply(workspace, safeText);
      addLocalMessage(workspace, 'agent', reply, 'Агент ' + workspace.name);
      state.workspace = workspace;
      persistLocal();
    }
    el.messageInput.value = '';
    render();
  } catch (error) {
    if (workspace) {
      addLocalMessage(workspace, 'agent', 'Не удалось получить ответ от сервера. Сообщение сохранено локально, попробуй отправить ещё раз.', 'Система');
      state.workspace = workspace;
      persistLocal();
      render();
    }
    el.messageInput.value = previousText || safeText;
    alert('Не удалось отправить сообщение. Попробуй еще раз.');
  } finally {
    state.sendingMessage = false;
    render();
  }
}

async function createTask(title) {
  if (!state.currentUser) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, details: 'Создано вручную через панель.' })
    });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    addLocalTask(workspace, title, 'Создано вручную через панель.');
    state.workspace = workspace;
    persistLocal();
  }
  render();
}

async function setTaskStatus(taskId, status) {
  if (!state.currentUser) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/tasks/' + taskId, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    const task = workspace.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.status = status;
    state.workspace = workspace;
    persistLocal();
  }
  render();
}

function bindEvents() {
  const clearPasswordError = () => el.password.setCustomValidity('');

  el.password.addEventListener('input', clearPasswordError);
  el.userSelect.addEventListener('change', clearPasswordError);

  el.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await loginUser(String(el.userSelect.value || '').trim(), el.password.value);
      render();
    } catch {
      el.password.setCustomValidity('Неверный demo-пароль');
      el.password.reportValidity();
    }
  });

  el.demoFill.addEventListener('click', () => {
    el.userSelect.value = demoUsers[0].id;
    el.password.value = 'demo';
    clearPasswordError();
  });

  el.logoutBtn.addEventListener('click', () => {
    logoutUser();
  });

  el.modeSwitch.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    await setWorkspaceMode(button.dataset.mode);
  });

  el.quickActions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick]');
    if (!button) return;
    el.messageInput.value = button.dataset.quick;
    el.messageInput.focus();
  });

  el.composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = el.messageInput.value.trim();
    if (!message) return;
    await sendMessage(message);
  });

  el.sendBtn.addEventListener('click', async () => {
    const message = el.messageInput.value.trim();
    if (!message) return;
    await sendMessage(message);
  });

  el.messageInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const message = el.messageInput.value.trim();
      if (!message) return;
      await sendMessage(message);
    }
  });

  el.taskList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-task-id][data-task-status]');
    if (!button) return;
    await setTaskStatus(button.dataset.taskId, button.dataset.taskStatus);
  });

  el.newTaskBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новая задача';
    el.promptLabel.textContent = 'Название';
    el.promptInput.value = '';
    state.pendingTask = true;
    el.promptModal.showModal();
  });

  el.promptModal.addEventListener('close', async () => {
    if (el.promptModal.returnValue !== 'ok' || !state.pendingTask) {
      state.pendingTask = false;
      return;
    }

    state.pendingTask = false;
    const value = el.promptInput.value.trim();
    if (!value) return;
    await createTask(value);
  });
}

async function bootstrap() {
  await detectBackend();
  await loadUsers();
  bindEvents();
  await loadSession();
  renderUserSelect();
  render();
}

bootstrap();
