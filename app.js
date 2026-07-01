const STORAGE_KEY = 'agenthub-client-state-v2';
const API_BASE = (window.AGENTHUB_API_BASE || '').replace(/\/$/, '');
const TIME_ZONE = 'Europe/Moscow';
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';

const demoUsers = [
  { id: 'support', name: 'Алина', title: 'Support operations', password: 'Support#2026', agentId: 'support-agent' },
  { id: 'sales', name: 'Дамир', title: 'Sales manager', password: 'Sales#2026', agentId: 'sales-agent' }
];

const fallbackWorkspaces = {
  'support-agent': {
    id: 'support-agent',
    name: 'Алина',
    title: 'Личный рабочий агент',
    mode: 'approve',
    model: 'OpenClaw workflow',
    quickActions: ['Найди свежую информацию в интернете', 'Сгенерируй изображение для ответа', 'Запусти поручение: разобрать тикет', 'Покажи статус поручений'],
    tasks: [],
    messages: [],
    agentConfig: { name: '', role: '', instructions: '', setupDone: false },
    missions: [],
    artifacts: []
  },
  'sales-agent': {
    id: 'sales-agent',
    name: 'Дамир',
    title: 'Личный рабочий агент',
    mode: 'approve',
    model: 'OpenClaw workflow',
    quickActions: ['Найди свежую информацию в интернете', 'Сгенерируй изображение для клиента', 'Запусти поручение: подготовить follow-up', 'Покажи статус поручений'],
    tasks: [],
    messages: [],
    agentConfig: { name: '', role: '', instructions: '', setupDone: false },
    missions: [],
    artifacts: []
  }
};

const onboardingSteps = [
  { title: 'Войти', text: 'Выбери свой рабочий аккаунт и введи пароль сотрудника.' },
  { title: 'Дать цель', text: 'Запусти Mission: опиши результат, который агент должен подготовить автономно.' },
  { title: 'Следить за планом', text: 'Агент разложит работу на шаги, покажет прогресс и текущий статус выполнения.' },
  { title: 'Забрать результат', text: 'Готовые черновики, ответы и рабочие результаты появляются в “Готовых материалах”.' }
];

const modeCopy = {
  answer: { label: 'Отвечает', description: 'Помощник только отвечает на вопросы.' },
  suggest: { label: 'Предлагает', description: 'Помощник предлагает текст или план, но ничего не меняет.' },
  approve: { label: 'Ждет подтверждения', description: 'Перед действием помощник попросит ваше “да”.' },
  execute: { label: 'Выполняет', description: 'Помощник сам выполняет безопасные действия.' }
};

const statusCopy = {
  todo: 'Нужно сделать',
  waiting: 'Ждет ответа',
  done: 'Готово',
  blocked: 'Есть проблема',
  running: 'В работе'
};

const agentTools = [
  { id: 'web', label: 'Поиск в интернете', status: 'включен' },
  { id: 'image', label: 'Генерация изображений', status: 'включена' }
];

const artifactTypeCopy = {
  reply: 'Ответ клиенту',
  draft: 'Черновик',
  mission: 'Результат поручения'
};

const state = {
  apiAvailable: false,
  currentUser: null,
  workspace: null,
  users: demoUsers,
  localWorkspaces: structuredClone(fallbackWorkspaces),
  pendingTask: false,
  pendingMission: false,
  sendingMessage: false,
  currentView: 'chat',
  sidebarCollapsed: window.matchMedia('(max-width: 1100px)').matches
};

const el = {
  authCard: document.getElementById('auth-card'),
  dashboard: document.getElementById('dashboard'),
  loginForm: document.getElementById('login-form'),
  userSelect: document.getElementById('user-select'),
  password: document.getElementById('password'),
  demoFill: document.getElementById('demo-fill'),
  logoutBtn: document.getElementById('logout-btn'),
  sideNav: document.getElementById('side-nav'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  profileName: document.getElementById('profile-name'),
  profileMeta: document.getElementById('profile-meta'),
  workspaceTitle: document.getElementById('workspace-title'),
  workspaceHint: document.getElementById('workspace-hint'),
  topbarSummary: document.getElementById('topbar-summary'),
  todaySummary: document.getElementById('today-summary'),
  chatSubtitle: document.getElementById('chat-subtitle'),
  modeSwitch: document.getElementById('mode-switch'),
  modeHelp: document.getElementById('mode-help'),
  quickActions: document.getElementById('quick-actions'),
  agentTools: document.getElementById('agent-tools'),
  messages: document.getElementById('messages'),
  composer: document.getElementById('composer'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  taskList: document.getElementById('task-list'),
  missionList: document.getElementById('mission-list'),
  artifactList: document.getElementById('artifact-list'),
  workflowGrid: document.getElementById('workflow-grid'),
  onboardingList: document.getElementById('onboarding-list'),
  newTaskBtn: document.getElementById('new-task-btn'),
  newMissionBtn: document.getElementById('new-mission-btn'),
  agentSettings: document.getElementById('agent-settings'),
  agentName: document.getElementById('agent-name'),
  agentRole: document.getElementById('agent-role'),
  agentInstructions: document.getElementById('agent-instructions'),
  resetWorkspaceBtn: document.getElementById('reset-workspace-btn'),
  navLinks: document.querySelectorAll('[data-view]'),
  viewPanels: document.querySelectorAll('[data-panel]'),
  todayPanel: document.getElementById('today-panel'),
  promptModal: document.getElementById('prompt-modal'),
  promptTitle: document.getElementById('prompt-title'),
  promptLabel: document.getElementById('prompt-label'),
  promptInput: document.getElementById('prompt-input'),
  promptHelp: document.getElementById('prompt-help'),
  promptSubmit: document.getElementById('prompt-submit')
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
  state.pendingMission = false;
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
  return `<span class="badge ${safeStatus}">${escapeHtml(statusCopy[status] || status)}</span>`;
}

function missionProgress(mission) {
  const value = Number(mission.progress || 0);
  return Math.max(0, Math.min(100, value));
}

function modeLabel(mode) {
  return modeCopy[mode]?.label || mode;
}

function modeDescription(mode) {
  return modeCopy[mode]?.description || '';
}

function artifactTypeLabel(type) {
  return artifactTypeCopy[type] || type || 'Материал';
}

function agentDisplayName(workspace) {
  return workspace?.agentConfig?.name || (workspace ? 'Агент ' + workspace.name : 'Агент');
}

function renderViewState() {
  el.navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.view === state.currentView);
  });
  el.viewPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== state.currentView);
  });
  el.todayPanel.classList.toggle('hidden', state.currentView !== 'chat');
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  el.authCard.classList.toggle('hidden', loggedIn);
  el.dashboard.classList.toggle('hidden', !loggedIn);
  el.dashboard.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  el.sidebarToggle?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  el.sidebarToggle?.setAttribute('aria-label', state.sidebarCollapsed ? 'Открыть меню' : 'Скрыть меню');
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
  const agentConfig = workspace.agentConfig || {};
  el.profileMeta.textContent = `${state.currentUser.title} · ${agentDisplayName(workspace)}`;
  el.workspaceTitle.textContent = `${workspace.name} · ${workspace.title}`;
  el.workspaceHint.textContent = 'Личный чат, поручения, задачи и готовые материалы.';
  const openTasks = workspace.tasks.filter((task) => task.status !== 'done').length;
  const runningMissions = (workspace.missions || []).filter((mission) => mission.status === 'running').length;
  const artifactCount = (workspace.artifacts || []).length;
  el.topbarSummary.textContent = `${workspace.model} · ${modeLabel(workspace.mode)} · ${openTasks} открытые задачи`;
  el.chatSubtitle.textContent = 'Напишите помощнику или запустите поручение.';
  el.modeHelp.textContent = modeDescription(workspace.mode);
  el.todaySummary.innerHTML = `
    <div><strong>${openTasks}</strong><span>открытые задачи</span></div>
    <div><strong>${runningMissions}</strong><span>поручения в работе</span></div>
    <div><strong>${artifactCount}</strong><span>готовые материалы</span></div>
  `;
  el.agentName.value = agentConfig.name || '';
  el.agentRole.value = agentConfig.role || '';
  el.agentInstructions.value = agentConfig.instructions || '';

  const modes = ['answer', 'suggest', 'approve', 'execute'];
  el.modeSwitch.innerHTML = modes.map((mode) => `
    <button class="mode-chip ${mode === workspace.mode ? 'active' : ''}" data-mode="${mode}" type="button">${escapeHtml(modeLabel(mode))}</button>
  `).join('');

  el.quickActions.innerHTML = workspace.quickActions.map((item) => `
    <button class="quick-chip" type="button" data-quick="${escapeHtml(item)}">${escapeHtml(item)}</button>
  `).join('');

  el.agentTools.innerHTML = agentTools.map((tool) => `
    <div class="tool-chip" data-tool="${escapeHtml(tool.id)}">
      <strong>${escapeHtml(tool.label)}</strong>
      <span>${escapeHtml(tool.status)}</span>
    </div>
  `).join('');

  el.messages.innerHTML = workspace.messages.length ? workspace.messages.map((message) => {
    const copyBtnHtml = message.role !== 'user' ? `<button class="copy-msg-btn" data-copy="${escapeHtml(message.text)}" type="button" title="Скопировать" aria-label="Скопировать ответ">⧉</button>` : '';
    return `
    <article class="message ${escapeHtml(message.role)}">
      <div class="message-meta">
        <div class="message-author">
          <span>${escapeHtml(message.author)}</span>
          ${copyBtnHtml}
        </div>
        <span>${escapeHtml(message.time)}</span>
      </div>
      <div>${escapeHtml(message.text)}</div>
    </article>
  `}).join('') : `
    <div class="empty-state">
      <strong>Настройте агента и начните с первого запроса</strong>
      <p>У этого сотрудника отдельная история. Сообщения других людей сюда не попадают.</p>
    </div>
  `;

  // Attach copy button listeners
  document.querySelectorAll('.copy-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });
  });

  scrollMessagesToBottom();

  el.taskList.innerHTML = workspace.tasks.length ? workspace.tasks.map((task) => `
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="panel-subtitle">${escapeHtml(task.details)}</div>
        </div>
        ${statusBadge(task.status)}
      </div>
      <div class="task-actions">
        <button type="button" data-task-status="todo" data-task-id="${escapeHtml(task.id)}">${statusCopy.todo}</button>
        <button type="button" data-task-status="waiting" data-task-id="${escapeHtml(task.id)}">${statusCopy.waiting}</button>
        <button type="button" data-task-status="done" data-task-id="${escapeHtml(task.id)}">${statusCopy.done}</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><strong>Задач пока нет</strong><p>Создайте первую задачу или запустите поручение помощнику.</p></div>';

  el.missionList.innerHTML = (workspace.missions || []).length ? (workspace.missions || []).map((mission) => `
    <div class="mission-item">
      <div class="mission-top">
        <div>
          <div class="task-title">${escapeHtml(mission.goal)}</div>
          <div class="panel-subtitle">Начато в ${escapeHtml(mission.createdAt || 'сейчас')} · ${escapeHtml(statusCopy[mission.status] || mission.status)}</div>
        </div>
        ${statusBadge(mission.status)}
      </div>
      <div class="progress-track"><span style="width: ${missionProgress(mission)}%"></span></div>
      <div class="mission-steps">
        ${(mission.steps || []).map((step) => `
          <div class="mission-step ${escapeHtml(step.status)}">
            <span></span>
            <p>${escapeHtml(step.title)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') : '<div class="empty-state"><strong>Поручений пока нет</strong><p>Нажмите “Новое поручение”, чтобы помощник составил план и подготовил результат.</p></div>';

  el.artifactList.innerHTML = (workspace.artifacts || []).length ? (workspace.artifacts || []).map((artifact) => `
    <article class="artifact-item">
      <div class="artifact-meta"><span>${escapeHtml(artifactTypeLabel(artifact.type))}</span></div>
      <strong>${escapeHtml(artifact.title)}</strong>
      <p>${escapeHtml(artifact.summary)}</p>
      <details>
        <summary>Открыть полностью</summary>
        <pre>${escapeHtml(artifact.content)}</pre>
      </details>
      <div class="artifact-actions">
        <button type="button" data-artifact-copy="${escapeHtml(artifact.id)}">Скопировать</button>
        <button type="button" data-artifact-task="${escapeHtml(artifact.id)}">Создать задачу</button>
      </div>
    </article>
  `).join('') : '<div class="empty-state"><strong>Готовых материалов пока нет</strong><p>Материалы появятся после выполнения поручений.</p></div>';

  const workflow = [
    { label: 'Как работает помощник', value: modeLabel(workspace.mode) },
    { label: 'Поручения', value: String((workspace.missions || []).length) },
    { label: 'Открытые задачи', value: String(openTasks) },
    { label: 'Готовые материалы', value: String(artifactCount) }
  ];

  el.workflowGrid.innerHTML = workflow.map((item) => `
    <div class="workflow-card">
      <div class="workflow-label">${escapeHtml(item.label)}</div>
      <div class="workflow-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  el.onboardingList.innerHTML = onboardingSteps.map((step, index) => `
    <div class="onboarding-step">
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(step.text)}</p>
      </div>
    </div>
  `).join('');
  renderViewState();
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

function configureDemoMode() {
  document.querySelectorAll('.demo-only').forEach((node) => {
    node.classList.toggle('hidden', !DEMO_MODE);
  });
}

function addLocalMessage(workspace, role, text, author) {
  workspace.messages.push({ id: newId(), role, author, time: now(), text });
  workspace.messages = workspace.messages.slice(-50);
}

function addLocalTask(workspace, title, details) {
  workspace.tasks.unshift({ id: newId(), title, details, status: 'todo' });
  workspace.tasks = workspace.tasks.slice(0, 12);
}

function buildLocalMission(goal) {
  const safeGoal = String(goal || '').trim() || 'Новое поручение помощнику';
  const artifactId = newId();
  return {
    mission: {
      id: newId(),
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

function startLocalMission(workspace, goal) {
  const result = buildLocalMission(goal);
  workspace.missions = [result.mission, ...(workspace.missions || [])].slice(0, 8);
  workspace.artifacts = [result.artifact, ...(workspace.artifacts || [])].slice(0, 8);
  addLocalTask(workspace, result.mission.goal, 'Создано как поручение помощнику с планом и готовым материалом.');
  return result;
}

function generateReply(workspace, message) {
  const lower = message.toLowerCase();

  if (/поруч|мисси|mission|план|исслед|проанализ|подготов|автоном|manus/.test(lower)) {
    const goal = message.replace(/создай|запусти|поручение|поручений|миссию|mission|план|агента|manus/gi, '').trim() || message;
    const result = startLocalMission(workspace, goal);
    return `Запустил поручение: «${result.mission.goal}». Составил план, начал выполнение и положил черновик результата в “Готовые материалы”.`;
  }

  if (/задач|task|сделай/.test(lower)) {
    const title = message.replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    addLocalTask(workspace, title, 'Создано из чата.');
    return workspace.mode === 'execute'
      ? `Готово: задача «${title}» добавлена.`
      : `Могу добавить задачу «${title}». Подтверди, если ок.`;
  }

  if (/картин|изображ|иллюстрац|image|generate image|сгенер/.test(lower)) {
    return 'Принял. У этого агента включена генерация изображений: подготовлю промпт, стиль и результат как готовый материал.';
  }

  if (/прайс|цена|документ|найди|поиск|интернет|web|сайт/.test(lower)) {
    return 'Понял. У агента включен поиск в интернете: сначала проверю свежую информацию, потом верну короткий вывод и источники.';
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
    return 'Выполняю безопасный сценарий и фиксирую результат в личном пространстве.';
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

function showTypingIndicator() {
  const msgEl = document.getElementById('messages');
  if (!msgEl) return;
  const existingTyping = document.getElementById('typing-indicator-msg');
  if (existingTyping) return;
  
  const typingHtml = `
    <article class="message assistant" id="typing-indicator-msg">
      <div class="message-meta">
        <span>Помощник</span>
      </div>
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </article>
  `;
  msgEl.insertAdjacentHTML('beforeend', typingHtml);
  msgEl.scrollTop = msgEl.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator-msg');
  if (indicator) indicator.remove();
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
      showTypingIndicator();
      const result = await apiRequest('/api/message', {
        method: 'POST',
        body: JSON.stringify({ text: safeText })
      });
      hideTypingIndicator();
      state.workspace = result.workspace;
    } else if (workspace) {
      showTypingIndicator();
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      const reply = generateReply(workspace, safeText);
      hideTypingIndicator();
      addLocalMessage(workspace, 'agent', reply, agentDisplayName(workspace));
      state.workspace = workspace;
      persistLocal();
    }
    el.messageInput.value = '';
    render();
  } catch (error) {
    hideTypingIndicator();
    if (workspace) {
      addLocalMessage(workspace, 'agent', 'Не удалось получить ответ от сервера. Сообщение сохранено локально, попробуй отправить ещё раз.', 'Система');
      state.workspace = workspace;
      persistLocal();
      render();
    }
    el.messageInput.value = previousText || safeText;
    alert('Не удалось отправить сообщение. Попробуй еще раз.');
  } finally {
    hideTypingIndicator();
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

async function createMission(goal) {
  if (!state.currentUser) return;
  const safeGoal = String(goal || '').trim();
  if (!safeGoal) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/missions', {
      method: 'POST',
      body: JSON.stringify({ goal: safeGoal })
    });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    const result = startLocalMission(workspace, safeGoal);
    addLocalMessage(workspace, 'agent', `Запустил поручение: «${result.mission.goal}». План и материал уже доступны справа.`, agentDisplayName(workspace));
    state.workspace = workspace;
    persistLocal();
  }
  render();
}

async function saveAgentSettings() {
  if (!state.currentUser) return;
  const payload = {
    name: el.agentName.value,
    role: el.agentRole.value,
    instructions: el.agentInstructions.value
  };
  if (state.apiAvailable) {
    const result = await apiRequest('/api/agent-settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    workspace.agentConfig = {
      name: String(payload.name || '').trim(),
      role: String(payload.role || '').trim(),
      instructions: String(payload.instructions || '').trim(),
      setupDone: Boolean(payload.name || payload.role || payload.instructions)
    };
    state.workspace = workspace;
    persistLocal();
  }
  render();
}

async function resetWorkspace() {
  if (!state.currentUser) return;
  if (!window.confirm('Очистить только ваше окружение: чат, задачи, поручения, материалы и настройки агента?')) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/workspace/reset', { method: 'POST', body: '{}' });
    state.workspace = result.workspace;
  } else {
    const workspace = currentWorkspace();
    workspace.tasks = [];
    workspace.messages = [];
    workspace.missions = [];
    workspace.artifacts = [];
    workspace.agentConfig = { name: '', role: '', instructions: '', setupDone: false };
    workspace.mode = 'approve';
    state.workspace = workspace;
    persistLocal();
  }
  state.currentView = 'settings';
  render();
}

function findArtifact(workspace, artifactId) {
  return (workspace.artifacts || []).find((artifact) => artifact.id === artifactId) || null;
}

async function copyArtifact(artifact) {
  if (!artifact) return;
  const text = artifact.content || artifact.summary || artifact.title || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt('Скопируйте текст', text);
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
      el.password.setCustomValidity('Не получилось войти. Проверьте пользователя и пароль.');
      el.password.reportValidity();
    }
  });

  el.demoFill.addEventListener('click', () => {
    el.userSelect.value = demoUsers[0].id;
    el.password.value = demoUsers[0].password;
    clearPasswordError();
  });

  el.logoutBtn.addEventListener('click', () => {
    logoutUser();
  });

  el.sidebarToggle.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    renderAuthState();
  });

  el.navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      state.currentView = link.dataset.view || 'chat';
      if (window.matchMedia('(max-width: 1100px)').matches) state.sidebarCollapsed = true;
      renderViewState();
      renderAuthState();
    });
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

  el.artifactList.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-artifact-copy]');
    const taskButton = event.target.closest('[data-artifact-task]');
    const workspace = currentWorkspace();
    if (!workspace) return;
    if (copyButton) {
      await copyArtifact(findArtifact(workspace, copyButton.dataset.artifactCopy));
      return;
    }
    if (taskButton) {
      const artifact = findArtifact(workspace, taskButton.dataset.artifactTask);
      if (!artifact) return;
      await createTask('Доработать материал: ' + artifact.title);
    }
  });

  el.agentSettings.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveAgentSettings();
  });

  el.resetWorkspaceBtn.addEventListener('click', async () => {
    await resetWorkspace();
  });

  el.newTaskBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новая задача';
    el.promptLabel.textContent = 'Что нужно не забыть?';
    el.promptInput.placeholder = 'Например: ответить клиенту по доступам';
    el.promptInput.value = '';
    el.promptHelp.textContent = '';
    el.promptSubmit.textContent = 'Добавить задачу';
    state.pendingTask = true;
    state.pendingMission = false;
    el.promptModal.showModal();
  });

  el.newMissionBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новое поручение помощнику';
    el.promptLabel.textContent = 'Какой результат нужно подготовить?';
    el.promptInput.placeholder = 'Например: разобрать тикет и подготовить черновик ответа';
    el.promptInput.value = '';
    el.promptHelp.textContent = 'Помощник сам составит план и положит результат в “Готовые материалы”.';
    el.promptSubmit.textContent = 'Запустить поручение';
    state.pendingTask = false;
    state.pendingMission = true;
    el.promptModal.showModal();
  });

  el.promptModal.addEventListener('close', async () => {
    if (el.promptModal.returnValue !== 'ok' || (!state.pendingTask && !state.pendingMission)) {
      state.pendingTask = false;
      state.pendingMission = false;
      return;
    }

    const value = el.promptInput.value.trim();
    if (!value) {
      state.pendingTask = false;
      state.pendingMission = false;
      return;
    }
    if (state.pendingMission) {
      state.pendingMission = false;
      state.pendingTask = false;
      await createMission(value);
      return;
    }
    state.pendingTask = false;
    await createTask(value);
  });
}

async function bootstrap() {
  await detectBackend();
  await loadUsers();
  configureDemoMode();
  bindEvents();
  await loadSession();
  renderUserSelect();
  render();
}

bootstrap();
