const STORAGE_KEY = 'agenthub-client-state-v2';
const SELECTED_AGENT_KEY = 'agenthub-selected-agent-id';
const API_BASE = (window.AGENTHUB_API_BASE || '').replace(/\/$/, '');
const TIME_ZONE = 'Europe/Moscow';
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';

const demoUsers = [
  { id: 'support', name: 'Алина', title: 'Поддержка клиентов', password: 'DemoSupport#2026', agentId: 'support-agent' },
  { id: 'sales', name: 'Дамир', title: 'Продажи', password: 'DemoSales#2026', agentId: 'sales-agent' }
];

const fallbackWorkspaces = {
  'support-agent': {
    id: 'support-agent',
    name: 'Алина',
    title: 'Личный рабочий агент',
    mode: 'execute',
    model: 'Автономный агент',
    quickActions: ['Разбери тикет и подготовь готовый ответ', 'Найди свежую информацию и подготовь краткий вывод', 'Сгенерируй изображение и сохрани результат', 'Покажи, что сейчас в работе'],
    tasks: [],
    messages: [],
    agentConfig: { name: '', role: '', instructions: '', memoryNotes: [], setupDone: false },
    missions: [],
    artifacts: []
  },
  'sales-agent': {
    id: 'sales-agent',
    name: 'Дамир',
    title: 'Личный рабочий агент',
    mode: 'execute',
    model: 'Автономный агент',
    quickActions: ['Подготовь follow-up клиенту', 'Найди свежую информацию и подготовь краткий вывод', 'Сгенерируй изображение для клиента', 'Покажи, что сейчас в работе'],
    tasks: [],
    messages: [],
    agentConfig: { name: '', role: '', instructions: '', memoryNotes: [], setupDone: false },
    missions: [],
    artifacts: []
  }
};

const onboardingSteps = [
  { title: 'Войти', text: 'Выбери свой рабочий аккаунт и введи пароль сотрудника.' },
  { title: 'Написать цель', text: 'Опишите результат обычным текстом: что проверить, сравнить, найти или подготовить.' },
  { title: 'Следить за планом', text: 'Агент разложит работу на шаги, покажет прогресс и текущий статус выполнения.' },
  { title: 'Забрать результат', text: 'Готовые черновики, ответы и рабочие результаты появляются в “Готовых материалах”.' }
];

const modeCopy = {
  answer: { label: 'Отвечает', description: 'Помощник только отвечает на вопросы.' },
  suggest: { label: 'Предлагает', description: 'Помощник предлагает текст или план, но ничего не меняет.' },
  approve: { label: 'Ждет подтверждения', description: 'Перед действием помощник попросит ваше “да”.' },
  execute: { label: 'Выполняет', description: 'Помощник сам выполняет безопасные действия.' }
};

const exampleRequests = [
  'Подготовь ответ клиенту по последнему тикету',
  'Найди свежую информацию и подготовь краткий вывод',
  'Разбери задачу и собери план действий',
  'Создай задачу: проверить доступы завтра утром'
];

const quickActionLabels = [
  { pattern: /интернет|свеж/i, label: 'Найти данные' },
  { pattern: /изображ/i, label: 'Изображение' },
  { pattern: /follow-up|тикет|результат|план/i, label: 'Сделать работу' },
  { pattern: /статус|работе/i, label: 'Что в работе' }
];

const statusCopy = {
  todo: 'Нужно сделать',
  waiting: 'Ждет ответа',
  done: 'Готово',
  blocked: 'Есть проблема',
  running: 'В работе',
  queued: 'В очереди',
  failed: 'Ошибка',
  cancelled: 'Отменено'
};

const agentTools = [
  { id: 'brain', label: 'Модель', status: 'проверяем' },
  { id: 'web', label: 'Поиск', status: 'включен' },
  { id: 'image', label: 'Изображения', status: 'включена' }
];

const artifactTypeCopy = {
  reply: 'Ответ клиенту',
  draft: 'Черновик',
  mission: 'Результат поручения',
  image: 'Изображение'
};

const state = {
  apiAvailable: false,
  currentUser: null,
  workspace: null,
  agents: [],
  users: demoUsers,
  localWorkspaces: structuredClone(fallbackWorkspaces),
  pendingTask: false,
  pendingMission: false,
  pendingAgent: false,
  sendingMessage: false,
  failedDraft: null,
  capabilities: {
    agentBrainConfigured: false,
    agentBrainAuthenticated: false,
    agentBrainReady: false,
    agentBrainLastError: '',
    imageGenerationConfigured: false
  },
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
  userOptions: document.getElementById('user-options'),
  backendStatus: document.getElementById('backend-status'),
  appStatus: document.getElementById('app-status'),
  logoutBtn: document.getElementById('logout-btn'),
  sideNav: document.getElementById('side-nav'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  sideNavToggle: document.getElementById('side-nav-toggle'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  profileName: document.getElementById('profile-name'),
  profileMeta: document.getElementById('profile-meta'),
  workspaceTitle: document.getElementById('workspace-title'),
  workspaceHint: document.getElementById('workspace-hint'),
  topbarSummary: document.getElementById('topbar-summary'),
  todaySummary: document.getElementById('today-summary'),
  nextStepCard: document.getElementById('next-step-card'),
  sideArtifacts: document.getElementById('side-artifacts'),
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
  onboardingList: document.getElementById('onboarding-list'),
  agentList: document.getElementById('agent-list'),
  newAgentBtn: document.getElementById('new-agent-btn'),
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
  promptTextarea: document.getElementById('prompt-textarea'),
  promptHelp: document.getElementById('prompt-help'),
  promptSubmit: document.getElementById('prompt-submit'),
  promptCancel: document.getElementById('prompt-cancel')
};

function persistLocal() {
  if (state.apiAvailable) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentUserId: state.currentUser?.id ?? null,
    currentWorkspaceId: state.workspace?.id ?? null,
    agents: state.agents,
    workspaces: state.localWorkspaces
  }));
}

function selectedAgentId() {
  try {
    return localStorage.getItem(SELECTED_AGENT_KEY) || '';
  } catch {
    return '';
  }
}

function persistSelectedAgent(agentId) {
  try {
    if (agentId) localStorage.setItem(SELECTED_AGENT_KEY, agentId);
    else localStorage.removeItem(SELECTED_AGENT_KEY);
  } catch {
    // ignore storage failures
  }
}

function restoreLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved?.workspaces) state.localWorkspaces = saved.workspaces;
    if (Array.isArray(saved?.agents)) state.agents = saved.agents;
    if (saved?.currentUserId) {
      state.currentUser = state.users.find((user) => user.id === saved.currentUserId) ?? null;
      const workspaceId = saved.currentWorkspaceId || state.currentUser?.agentId;
      state.workspace = state.currentUser ? state.localWorkspaces[workspaceId] ?? state.localWorkspaces[state.currentUser.agentId] ?? null : null;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function recoverUnauthorized() {
  state.currentUser = null;
  state.workspace = null;
  state.agents = [];
  state.sendingMessage = false;
  state.pendingTask = false;
  state.pendingMission = false;
  state.pendingAgent = false;
  if (el.authCard && el.dashboard) render();
}

function announceStatus(message) {
  if (el.appStatus) el.appStatus.textContent = message;
}

async function apiRequest(path, options = {}) {
  const { allowUnauthorized = false, headers = {}, ...fetchOptions } = options;
  const url = API_BASE ? API_BASE + path : path;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(state.workspace?.id ? { 'X-Agent-Id': state.workspace.id } : {}),
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

function replaceAgentInState(workspace) {
  if (!workspace?.id) return;
  state.agents = state.agents.some((agent) => agent.id === workspace.id)
    ? state.agents.map((agent) => agent.id === workspace.id ? workspace : agent)
    : [...state.agents, workspace];
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

function missionToolLabel(toolId) {
  const labels = {
    planner: 'План',
    web: 'Web',
    files: 'Файлы',
    image: 'Изображения',
    artifact: 'Материал'
  };
  return labels[toolId] || toolId || 'Шаг';
}

function setPromptField(multiline) {
  el.promptInput.classList.toggle('hidden', multiline);
  el.promptInput.required = !multiline;
  el.promptTextarea.classList.toggle('hidden', !multiline);
  el.promptTextarea.required = multiline;
}

function renderMissionHandoff(workspace, mission) {
  const artifact = findArtifact(workspace, mission.artifactId);
  if (!artifact) return '';
  return `
    <div class="artifact-handoff">
      <div>
        <span>Готовый материал</span>
        <strong>${escapeHtml(artifact.title)}</strong>
      </div>
      <button type="button" data-artifact-download="${escapeHtml(artifact.id)}">Скачать</button>
    </div>
  `;
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

function artifactFileName(artifact) {
  const fallbackExt = artifact?.type === 'image' ? '.png' : '.txt';
  return artifact?.downloadName || (String(artifact?.title || 'agenthub-file').replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'agenthub-file') + fallbackExt;
}

function artifactMimeType(artifact) {
  return artifact?.mimeType || (artifact?.type === 'image' ? 'image/png' : 'text/plain;charset=utf-8');
}

function artifactDataUrl(artifact) {
  if (!artifact?.content) return '';
  if (artifact.contentEncoding === 'base64') {
    return 'data:' + artifactMimeType(artifact) + ';base64,' + artifact.content;
  }
  return 'data:' + artifactMimeType(artifact) + ',' + encodeURIComponent(artifact.content);
}

function renderArtifactAttachment(artifact) {
  if (!artifact) return '';
  const preview = artifact.type === 'image' && artifact.content
    ? '<img src="' + artifactDataUrl(artifact) + '" alt="' + escapeHtml(artifact.title) + '">'
    : '<pre>' + escapeHtml(artifact.content || artifact.summary || '') + '</pre>';
  return '<div class="message-attachment">' +
    '<div class="artifact-meta"><span>' + escapeHtml(artifactTypeLabel(artifact.type)) + '</span></div>' +
    '<strong>' + escapeHtml(artifact.title) + '</strong>' +
    preview +
    '<button class="ghost-btn" type="button" data-artifact-download="' + escapeHtml(artifact.id) + '">Скачать файл</button>' +
    '</div>';
}

function renderArtifactBody(artifact) {
  if (artifact.type === 'image' && artifact.content) {
    return '<img class="artifact-preview" src="' + artifactDataUrl(artifact) + '" alt="' + escapeHtml(artifact.title) + '">';
  }
  return '<details><summary>Открыть полностью</summary><pre>' + escapeHtml(artifact.content || artifact.summary || '') + '</pre></details>';
}

function quickActionLabel(text) {
  const value = String(text || '');
  return quickActionLabels.find((item) => item.pattern.test(value))?.label || value;
}

function backendStatusText() {
  if (state.apiAvailable) return 'Подключено к рабочему серверу. Данные сохраняются в вашем личном окружении.';
  if (DEMO_MODE) return 'Демо-режим: данные сохраняются только в этом браузере.';
  return 'Сервер недоступен. Рабочие действия заблокированы, чтобы не потерять данные.';
}

function nextStep(workspace) {
  const agentConfig = workspace.agentConfig || {};
  if (!agentConfig.setupDone) {
    return {
      title: 'Можно сразу писать цель',
      text: 'Настройки не обязательны: агент уже умеет принять задачу, составить план и сохранить результат.',
      action: 'Вставить пример',
      intent: 'example'
    };
  }
  if (!(workspace.missions || []).length && !(workspace.tasks || []).length && !(workspace.artifacts || []).length) {
    return {
      title: 'Начните с цели',
      text: 'Напишите, что нужно получить: ответ клиенту, анализ, поиск, план или материал.',
      action: 'Вставить пример',
      intent: 'example'
    };
  }
  const runningMissions = (workspace.missions || []).filter((mission) => mission.status === 'running').length;
  if (runningMissions) {
    return {
      title: 'Агент работает',
      text: 'Откройте ход работы, чтобы увидеть план, инструменты и связанный результат.',
      action: 'Открыть ход работы',
      view: 'missions'
    };
  }
  if ((workspace.artifacts || []).length) {
    return {
      title: 'Проверьте готовые материалы',
      text: 'Материал можно раскрыть полностью, скопировать или превратить в задачу на доработку.',
      action: 'Открыть материалы',
      view: 'artifacts'
    };
  }
  return {
    title: 'Продолжайте из чата',
    text: 'Напишите новую цель в чат. Агент сам решит, нужен ли план, поиск, файл или задача.',
    action: 'Вставить пример',
    intent: 'example'
  };
}

function renderNextStep(workspace) {
  const item = nextStep(workspace);
  el.nextStepCard.innerHTML = `
    <strong>${escapeHtml(item.title)}</strong>
    <p>${escapeHtml(item.text)}</p>
    <button class="ghost-btn next-step-action" type="button" data-next-view="${escapeHtml(item.view || '')}" data-next-intent="${escapeHtml(item.intent || '')}">${escapeHtml(item.action)}</button>
  `;
}

function openMissionPrompt() {
  el.promptTitle.textContent = 'Новая цель для агента';
  el.promptLabel.textContent = 'Что нужно получить?';
  setPromptField(true);
  el.promptTextarea.placeholder = 'Например: найди информацию, сравни варианты и подготовь короткий итог';
  el.promptTextarea.value = '';
  el.promptHelp.textContent = 'Агент сам разложит цель на шаги и сохранит результат.';
  el.promptSubmit.textContent = 'Запустить агента';
  state.pendingTask = false;
  state.pendingMission = true;
  el.promptModal.showModal();
  el.promptTextarea.focus();
}

function openTaskPrompt() {
  el.promptTitle.textContent = 'Новая задача';
  el.promptLabel.textContent = 'Что нужно не забыть?';
  setPromptField(false);
  el.promptInput.placeholder = 'Например: ответить клиенту по доступам';
  el.promptInput.value = '';
  el.promptHelp.textContent = 'Задача - это ручное напоминание. Для результата пишите цель агенту.';
  el.promptSubmit.textContent = 'Запомнить';
  state.pendingTask = true;
  state.pendingMission = false;
  el.promptModal.showModal();
  el.promptInput.focus();
}

function openAgentPrompt() {
  el.promptTitle.textContent = 'Новый агент';
  el.promptLabel.textContent = 'Как назвать агента?';
  setPromptField(false);
  el.promptInput.placeholder = 'Например: Агент по продажам';
  el.promptInput.value = '';
  el.promptHelp.textContent = 'После создания откроются настройки роли, правил и поведения агента.';
  el.promptSubmit.textContent = 'Создать агента';
  state.pendingTask = false;
  state.pendingMission = false;
  state.pendingAgent = true;
  el.promptModal.showModal();
  el.promptInput.focus();
}

function renderViewState() {
  el.navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.view === state.currentView);
    if (link.dataset.view === state.currentView) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  el.viewPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== state.currentView);
  });
  el.dashboard?.classList.toggle('non-chat-view', state.currentView !== 'chat');
  el.todayPanel.classList.toggle('hidden', state.currentView !== 'chat');
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  el.authCard.classList.toggle('hidden', loggedIn);
  el.dashboard.classList.toggle('hidden', !loggedIn);
  el.dashboard.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  el.sidebarToggle?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  el.sidebarToggle?.setAttribute('aria-label', state.sidebarCollapsed ? 'Открыть меню' : 'Скрыть меню');
  el.sideNavToggle?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  el.sideNavToggle?.setAttribute('aria-label', state.sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню');
  const navHidden = loggedIn && state.sidebarCollapsed && window.matchMedia('(max-width: 1100px)').matches;
  el.sideNav?.toggleAttribute('inert', navHidden);
  el.sideNav?.setAttribute('aria-hidden', String(navHidden));
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  renderAuthState();
  if (collapsed) el.sidebarToggle?.focus({ preventScroll: true });
}

function renderUserSelect() {
  const selected = el.userSelect.value;
  const options = (DEMO_MODE ? state.users : []).map((user) => {
    const option = document.createElement('option');
    option.value = String(user.id);
    option.label = `${user.name} · ${user.title}`;
    return option;
  });
  el.userOptions?.replaceChildren(...options);
  if (DEMO_MODE && state.users.some((user) => String(user.id) === selected)) {
    el.userSelect.value = selected;
  } else if (DEMO_MODE && state.users[0]) {
    el.userSelect.value = String(state.users[0].id);
  }
  if (el.backendStatus) el.backendStatus.textContent = backendStatusText();
}

function renderAgentList(workspace) {
  if (!el.agentList) return;
  const agents = state.agents.length ? state.agents : (workspace ? [workspace] : []);
  el.agentList.innerHTML = agents.length ? agents.map((agent) => {
    const config = agent.agentConfig || {};
    const active = workspace && agent.id === workspace.id;
    const title = config.role || agent.title || 'Личный рабочий агент';
    return `
      <article class="agent-item ${active ? 'active' : ''}" role="listitem">
        <div>
          <strong>${escapeHtml(agentDisplayName(agent))}</strong>
          <p>${escapeHtml(title)}</p>
        </div>
        <div class="agent-actions">
          <button type="button" data-agent-select="${escapeHtml(agent.id)}" ${active ? 'disabled aria-current="true"' : ''}>${active ? 'Открыт' : 'Открыть'}</button>
          <button class="danger-action" type="button" data-agent-archive="${escapeHtml(agent.id)}" ${agents.length <= 1 ? 'disabled' : ''}>Архив</button>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty-state"><strong>Агентов пока нет</strong><p>Создайте первого агента под рабочую роль.</p></div>';
}

function renderWorkspace() {
  const workspace = currentWorkspace();
  if (!state.currentUser || !workspace) return;

  el.sendBtn.disabled = state.sendingMessage;
  el.sendBtn.textContent = state.sendingMessage ? 'Работаю…' : 'Запустить';

  el.profileName.textContent = 'Напишите цель';
  const agentConfig = workspace.agentConfig || {};
  el.profileMeta.textContent = `${state.currentUser.title} · ${agentDisplayName(workspace)}`;
  el.workspaceTitle.textContent = `${agentDisplayName(workspace)} · ${workspace.title}`;
  el.workspaceHint.textContent = 'Поставьте цель. Агент спланирует работу, выполнит шаги и отдаст готовый материал.';
  const openTasks = workspace.tasks.filter((task) => task.status !== 'done').length;
  const runningMissions = (workspace.missions || []).filter((mission) => mission.status === 'running').length;
  const artifactCount = (workspace.artifacts || []).length;
  el.topbarSummary.textContent = `Агент работает сам · ${runningMissions} в работе · ${artifactCount} готово`;
  el.chatSubtitle.textContent = 'Опишите конечный результат, не команды по шагам.';
  el.modeHelp.textContent = 'Автономный режим включен по умолчанию.';
  el.todaySummary.innerHTML = `
    <div><strong>${runningMissions}</strong><span>в работе</span></div>
    <div><strong>${artifactCount}</strong><span>готово</span></div>
    <div><strong>${openTasks}</strong><span>память</span></div>
  `;
  renderNextStep(workspace);
  el.agentName.value = agentConfig.name || '';
  el.agentRole.value = agentConfig.role || '';
  el.agentInstructions.value = agentConfig.instructions || '';

  const modes = ['execute'];
  el.modeSwitch.innerHTML = modes.map((mode) => `
    <button class="mode-chip ${mode === workspace.mode ? 'active' : ''}" data-mode="${mode}" type="button" aria-pressed="${mode === workspace.mode}">${escapeHtml(modeLabel(mode))}</button>
  `).join('');

  el.quickActions.innerHTML = workspace.quickActions.map((item) => `
    <button class="quick-chip" type="button" data-quick="${escapeHtml(item)}" title="${escapeHtml(item)}" aria-label="${escapeHtml(item)}">${escapeHtml(quickActionLabel(item))}</button>
  `).join('');

  const tools = agentTools.map((tool) => {
    if (tool.id === 'brain') {
      let status = 'не настроена';
      if (state.capabilities.agentBrainLastError) status = 'ошибка gateway';
      else if (state.capabilities.agentBrainReady) status = 'готова';
      else if (state.capabilities.agentBrainConfigured && !state.capabilities.agentBrainAuthenticated) status = 'нет токена';
      else if (state.capabilities.agentBrainConfigured) status = 'проверяется';
      return { ...tool, status };
    }
    if (tool.id === 'image') return { ...tool, status: state.capabilities.imageGenerationConfigured ? 'включена' : 'не настроена' };
    return tool;
  });
  el.agentTools.innerHTML = tools.map((tool) => `
    <div class="tool-chip" data-tool="${escapeHtml(tool.id)}">
      <strong>${escapeHtml(tool.label)}</strong>
      <span>${escapeHtml(tool.status)}</span>
    </div>
  `).join('');

  el.messages.innerHTML = workspace.messages.length ? workspace.messages.map((message) => {
    const copyBtnHtml = message.role !== 'user' ? `<button class="copy-msg-btn" data-message-copy="${escapeHtml(message.id)}" type="button" title="Скопировать" aria-label="Скопировать ответ">⧉</button>` : '';
    return `
    <article class="message ${escapeHtml(message.role)}">
      <div class="message-meta">
        <div class="message-author">
          <span>${escapeHtml(message.author)}</span>
          ${copyBtnHtml}
        </div>
        <span>${escapeHtml(message.time)}</span>
      </div>
      <div class="message-text">${escapeHtml(message.text)}</div>
      ${renderArtifactAttachment(findArtifact(workspace, message.artifactId))}
    </article>
  `}).join('') : `
    <div class="empty-state">
      <strong>Поставьте первую задачу</strong>
      <p>Напишите, что нужно получить. Агент сам составит план, выполнит шаги и сохранит результат справа.</p>
      <div class="empty-actions">
        ${exampleRequests.map((request) => `<button class="quick-chip" type="button" data-empty-request="${escapeHtml(request)}">${escapeHtml(request)}</button>`).join('')}
      </div>
    </div>
  `;

  scrollMessagesToBottom();

  el.taskList.innerHTML = workspace.tasks.length ? workspace.tasks.map((task) => `
    <div class="task-item" role="listitem">
      <div class="task-top">
        <div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="panel-subtitle">${escapeHtml(task.details)}</div>
        </div>
        ${statusBadge(task.status)}
      </div>
      <div class="task-actions">
        <button type="button" data-task-status="todo" data-task-id="${escapeHtml(task.id)}" aria-pressed="${task.status === 'todo'}" aria-label="Пометить задачу ${escapeHtml(task.title)} как: ${statusCopy.todo}">${statusCopy.todo}</button>
        <button type="button" data-task-status="waiting" data-task-id="${escapeHtml(task.id)}" aria-pressed="${task.status === 'waiting'}" aria-label="Пометить задачу ${escapeHtml(task.title)} как: ${statusCopy.waiting}">${statusCopy.waiting}</button>
        <button type="button" data-task-status="done" data-task-id="${escapeHtml(task.id)}" aria-pressed="${task.status === 'done'}" aria-label="Пометить задачу ${escapeHtml(task.title)} как: ${statusCopy.done}">${statusCopy.done}</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><strong>Напоминаний пока нет</strong><p>Напоминания нужны только для ручных заметок. Для результата просто напишите цель агенту.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-request="Разбери задачу и подготовь план действий">Написать цель</button><button class="quick-chip" type="button" data-empty-task>Запомнить</button></div></div>';

  el.missionList.innerHTML = (workspace.missions || []).length ? (workspace.missions || []).map((mission) => `
    <div class="mission-item" role="listitem">
      <div class="mission-top">
        <div>
          <div class="task-title">${escapeHtml(mission.goal)}</div>
          <div class="panel-subtitle">Создано ${escapeHtml(mission.createdAt || 'сейчас')} · ${escapeHtml(statusCopy[mission.status] || mission.status)}</div>
        </div>
        ${statusBadge(mission.status)}
      </div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${missionProgress(mission)}" aria-label="Прогресс поручения: ${missionProgress(mission)}%"><span style="width: ${missionProgress(mission)}%"></span></div>
      <div class="mission-tools" aria-label="Инструменты поручения">
        ${(mission.tools || []).map((tool) => `
          <span class="mission-tool ${escapeHtml(tool.status || 'queued')}">${escapeHtml(tool.label || missionToolLabel(tool.id))} · ${escapeHtml(statusCopy[tool.status] || tool.status || 'В очереди')}</span>
        `).join('')}
      </div>
      <div class="mission-steps">
        ${(mission.steps || []).map((step) => `
          <div class="mission-step ${escapeHtml(step.status)}">
            <span></span>
            <p>
              <span class="sr-only">${escapeHtml(statusCopy[step.status] || step.status)}: </span>
              <strong>${escapeHtml(step.title)}</strong>
              <small>${escapeHtml(missionToolLabel(step.tool))}${step.detail ? ' · ' + escapeHtml(step.detail) : ''}</small>
            </p>
          </div>
        `).join('')}
      </div>
      ${(mission.events || []).length ? `
        <details class="mission-events">
          <summary>Журнал событий</summary>
          ${mission.events.map((event) => `
            <div class="mission-event">
              <span>${escapeHtml(event.time || '')}</span>
              <strong>${escapeHtml(event.title || 'Событие')}</strong>
              <p>${escapeHtml(event.text || '')}</p>
            </div>
          `).join('')}
        </details>
      ` : ''}
      ${renderMissionHandoff(workspace, mission)}
    </div>
  `).join('') : '<div class="empty-state"><strong>Агент еще не работал</strong><p>Напишите цель на рабочем столе. Здесь появятся план, шаги, инструменты и прогресс.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-request="Подготовь рабочий результат с планом">Написать цель</button></div></div>';

  const artifacts = workspace.artifacts || [];
  el.sideArtifacts.innerHTML = artifacts.length ? `
    <div class="side-section-title">Последние материалы</div>
    ${artifacts.slice(0, 2).map((artifact) => `
      <button class="side-artifact" type="button" data-next-view="artifacts">
        <span>${escapeHtml(artifactTypeLabel(artifact.type))}</span>
        <strong>${escapeHtml(artifact.title)}</strong>
      </button>
    `).join('')}
  ` : `
    <div class="side-section-title">Результат появится здесь</div>
    <p class="side-empty">Когда агент закончит работу, готовый материал будет доступен отдельно от чата.</p>
  `;

  el.artifactList.innerHTML = artifacts.length ? artifacts.map((artifact) => `
    <article class="artifact-item" role="listitem">
      <div class="artifact-meta"><span>${escapeHtml(artifactTypeLabel(artifact.type))}</span></div>
      <strong>${escapeHtml(artifact.title)}</strong>
      <p>${escapeHtml(artifact.summary)}</p>
      ${renderArtifactBody(artifact)}
      <div class="artifact-actions">
        <button type="button" data-artifact-download="${escapeHtml(artifact.id)}">Экспорт</button>
        <button type="button" data-artifact-copy="${escapeHtml(artifact.id)}">Скопировать</button>
        <button type="button" data-artifact-task="${escapeHtml(artifact.id)}">Создать задачу</button>
      </div>
    </article>
  `).join('') : '<div class="empty-state"><strong>Результатов пока нет</strong><p>Готовые ответы, файлы и изображения появятся здесь после работы агента.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-request="Подготовь первый рабочий результат">Написать цель</button></div></div>';

  el.onboardingList.innerHTML = onboardingSteps.map((step, index) => `
    <div class="onboarding-step">
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(step.text)}</p>
      </div>
    </div>
  `).join('');
  renderAgentList(workspace);
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

function addLocalMessage(workspace, role, text, author, extra = {}) {
  const message = { id: newId(), role, author, time: now(), text, ...extra };
  workspace.messages.push(message);
  workspace.messages = workspace.messages.slice(-50);
  return message;
}

function addLocalTask(workspace, title, details) {
  workspace.tasks.unshift({ id: newId(), title, details, status: 'todo' });
  workspace.tasks = workspace.tasks.slice(0, 12);
}

function buildLocalMission(goal) {
  const safeGoal = String(goal || '').trim() || 'Новое поручение помощнику';
  const lower = safeGoal.toLowerCase();
  const artifactId = newId();
  const runId = newId();
  const needsWeb = /рынок|конкур|цена|сайт|найди|поиск|исслед|анализ|новост|интернет|web/.test(lower);
  const needsFile = /таблиц|презентац|файл|документ|отчет|pdf|excel|csv/.test(lower);
  const needsImage = isImageRequest(safeGoal);
  const tools = [
    { id: 'planner', label: 'Планировщик', status: 'done' },
    ...(needsWeb ? [{ id: 'web', label: 'Поиск в интернете', status: 'queued' }] : []),
    ...(needsFile ? [{ id: 'files', label: 'Файлы и материалы', status: 'queued' }] : []),
    ...(needsImage ? [{ id: 'image', label: 'Генерация изображений', status: 'queued' }] : []),
    { id: 'artifact', label: 'Готовый результат', status: 'done' }
  ];
  const steps = [
    { title: 'Понять конечную цель и критерий готовности', status: 'done', tool: 'planner', detail: 'Агент выделил ожидаемый результат из запроса сотрудника.' },
    { title: 'Составить рабочий план', status: 'done', tool: 'planner', detail: 'Задача разбита на этапы.' },
    needsWeb
      ? { title: 'Собрать внешнюю информацию', status: 'queued', tool: 'web', detail: 'Нужен реальный web/browser worker.' }
      : { title: 'Проверить внутренний контекст', status: 'done', tool: 'planner', detail: 'Для первого черновика достаточно данных из запроса.' },
    needsFile
      ? { title: 'Подготовить файл или таблицу', status: 'queued', tool: 'files', detail: 'Нужен рабочий backend.' }
      : { title: 'Собрать текстовый результат', status: 'queued', tool: 'artifact', detail: 'Нужен рабочий backend и модель агента.' },
    { title: 'Передать итог сотруднику', status: 'queued', tool: 'artifact', detail: 'Offline-режим не создает готовый результат.' }
  ];
  const progress = Math.round((steps.filter((step) => step.status === 'done').length / steps.length) * 100);
  const status = 'queued';
  return {
    mission: {
      id: newId(),
      runId: runId,
      goal: safeGoal,
      status: status,
      progress: progress,
      tools: tools,
      steps: steps,
      events: [
        { time: now(), title: 'Поручение принято', text: safeGoal },
        { time: now(), title: 'План создан', text: steps.map((step, index) => (index + 1) + '. ' + step.title).join('\n') },
        { time: now(), title: 'Ожидает backend', text: 'Offline-режим показывает план, но не выполняет поручение и не создает итоговый материал.' }
      ],
      output: 'Ожидает подключения backend',
      artifactId: artifactId,
      createdAt: now()
    },
    artifact: {
      id: artifactId,
      title: 'Рабочий результат: ' + safeGoal.slice(0, 48),
      type: 'mission',
      summary: 'Offline-план без выполнения. Для результата нужен рабочий backend и модель агента.',
      content: 'Цель: ' + safeGoal + '\n\nПлан выполнения:\n' + steps.map((step, index) => (index + 1) + '. [' + (step.status || 'todo') + '] ' + step.title + ' — ' + (step.detail || '')).join('\n') + '\n\nИтог не создан: offline-режим не выполняет поручения и не обращается к модели агента.'
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

function isImageRequest(message) {
  const lower = String(message || '').toLowerCase();
  if (/картин|изображ|иллюстрац|image|picture|photo|svg/.test(lower)) return true;
  return /(сгенер|генерир|нарису|рису|создай|сделай|generate|draw|create).*(кот|кота|кошк|cat|портрет|логотип|баннер|иконк)/.test(lower);
}

function generateReply(workspace, message) {

  if (isImageRequest(message)) {
    return {
      text: 'Сервер сейчас недоступен, поэтому я не могу запустить реальную генерацию изображения. Подключитесь к рабочему серверу и отправьте запрос еще раз.'
    };
  }

  return {
    text: 'Сервер сейчас недоступен, поэтому агент не может обратиться к модели, инструментам и рабочему пространству. Проверь подключение к backend и повтори запрос.'
  };
}

async function detectBackend() {
  if (DEMO_MODE) {
    state.apiAvailable = false;
    return;
  }
  try {
    const response = await fetch((API_BASE ? API_BASE : '') + '/api/health', { cache: 'no-store', credentials: 'include' });
    state.apiAvailable = response.ok;
    if (response.ok) {
      const health = await response.json();
      state.capabilities.agentBrainConfigured = Boolean(health.agentBrainConfigured);
      state.capabilities.agentBrainAuthenticated = Boolean(health.agentBrainAuthenticated);
      state.capabilities.agentBrainReady = Boolean(health.agentBrainReady);
      state.capabilities.agentBrainLastError = String(health.agentBrainLastError || '');
      state.capabilities.imageGenerationConfigured = Boolean(health.imageGenerationConfigured);
    }
  } catch {
    state.apiAvailable = false;
  }
}

async function loadUsers() {
  if (state.apiAvailable) {
    try {
      const users = await apiRequest('/api/users', { allowUnauthorized: true });
      if (Array.isArray(users) && users.length) {
        state.users = users;
        return;
      }
    } catch {
      // Public employee listing is disabled in production.
    }
  }
  state.users = DEMO_MODE ? demoUsers : [];
}

async function loadSession() {
  if (state.apiAvailable) {
    try {
      const me = await apiRequest('/api/me', { allowUnauthorized: true });
      state.currentUser = me.user;
      state.agents = Array.isArray(me.agents) ? me.agents : (me.workspace ? [me.workspace] : []);
      const storedAgentId = selectedAgentId();
      state.workspace = state.agents.find((agent) => agent.id === storedAgentId) || me.workspace;
      if (state.workspace?.id) persistSelectedAgent(state.workspace.id);
      return Boolean(state.currentUser && state.workspace);
    } catch (error) {
      if (error.status !== 401) throw error;
      state.currentUser = null;
      state.workspace = null;
      state.agents = [];
      return false;
    }
  }

  if (DEMO_MODE) restoreLocal();
  return Boolean(state.currentUser && state.workspace);
}

async function loginUser(login, password) {
  if (!state.apiAvailable && !DEMO_MODE) throw new Error('backend_unavailable');
  if (state.apiAvailable) {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    state.currentUser = result.user;
    state.agents = Array.isArray(result.agents) ? result.agents : (result.workspace ? [result.workspace] : []);
    const storedAgentId = selectedAgentId();
    state.workspace = state.agents.find((agent) => agent.id === storedAgentId) || result.workspace;
    replaceAgentInState(state.workspace);
    persistSelectedAgent(state.workspace?.id);
    return;
  }

  const user = demoUsers.find((item) => item.id === login);
  if (!user || user.password !== password) throw new Error('invalid_credentials');
  state.currentUser = user;
  state.workspace = structuredClone(state.localWorkspaces[user.agentId]);
  state.agents = Object.values(state.localWorkspaces).filter((workspace) => workspace.ownerUserId === user.id || workspace.id === user.agentId);
  replaceAgentInState(state.workspace);
  persistSelectedAgent(state.workspace?.id);
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
  state.agents = [];
  persistSelectedAgent('');
  if (!state.apiAvailable) localStorage.removeItem(STORAGE_KEY);
  render();
}

async function selectAgent(agentId) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) return;
  state.workspace = agent;
  persistSelectedAgent(agent.id);
  state.currentView = 'chat';
  render();
}

async function createAgent(name) {
  const safeName = String(name || '').trim();
  if (!safeName || !state.currentUser) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: safeName })
    });
    state.agents = Array.isArray(result.agents) ? result.agents : [];
    state.workspace = result.workspace;
    persistSelectedAgent(state.workspace?.id);
  } else {
    const workspace = {
      id: state.currentUser.id + '-' + newId(),
      name: safeName,
      title: 'Личный рабочий агент',
      mode: 'execute',
      model: 'Автономный агент',
      quickActions: ['Найди свежую информацию и подготовь краткий вывод', 'Сгенерируй изображение и сохрани результат', 'Подготовь рабочий результат с планом', 'Покажи, что сейчас в работе'],
      tasks: [],
      messages: [],
      missions: [],
      artifacts: [],
      ownerUserId: state.currentUser.id,
      agentConfig: { name: safeName, role: '', instructions: '', memoryNotes: [], setupDone: true }
    };
    state.localWorkspaces[workspace.id] = workspace;
    state.agents = [...state.agents, workspace];
    state.workspace = workspace;
    persistSelectedAgent(state.workspace?.id);
    persistLocal();
  }
  state.currentView = 'settings';
  render();
}

async function archiveAgent(agentId) {
  if (!state.currentUser || state.agents.length <= 1) return;
  if (!window.confirm('Архивировать этого агента? Его чат и материалы больше не будут показаны в списке.')) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/agents/' + encodeURIComponent(agentId), { method: 'DELETE' });
    state.agents = Array.isArray(result.agents) ? result.agents : [];
    state.workspace = state.agents.find((agent) => agent.id === state.workspace?.id) || result.workspace || state.agents[0] || null;
    persistSelectedAgent(state.workspace?.id);
  } else {
    state.agents = state.agents.filter((agent) => agent.id !== agentId);
    delete state.localWorkspaces[agentId];
    state.workspace = state.agents.find((agent) => agent.id === state.workspace?.id) || state.agents[0] || null;
    persistSelectedAgent(state.workspace?.id);
    persistLocal();
  }
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
    replaceAgentInState(state.workspace);
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
  const workspace = currentWorkspace();
  if (!workspace) return;
  const requestWorkspaceId = workspace.id;
  const retryingFailedDraft = Boolean(
    state.failedDraft
    && state.failedDraft.text === safeText
    && workspace.messages.some((message) => message.id === state.failedDraft.messageId)
  );

  state.sendingMessage = true;
  el.messageInput.value = '';
  const optimisticMessageId = retryingFailedDraft
    ? state.failedDraft.messageId
    : addLocalMessage(workspace, 'user', safeText, state.currentUser.name).id;
  state.failedDraft = null;
  state.workspace = workspace;
  render();

  try {
    if (state.apiAvailable) {
      showTypingIndicator();
      const result = await apiRequest('/api/message', {
        method: 'POST',
        body: JSON.stringify({ text: safeText })
      });
      hideTypingIndicator();
      replaceAgentInState(result.workspace);
      if (state.workspace?.id === requestWorkspaceId) {
        state.workspace = result.workspace;
        persistSelectedAgent(state.workspace?.id);
      }
    } else {
      showTypingIndicator();
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      const generated = generateReply(workspace, safeText);
      const reply = typeof generated === 'string' ? generated : generated.text;
      hideTypingIndicator();
      addLocalMessage(workspace, 'agent', reply, agentDisplayName(workspace), generated.artifact ? { artifactId: generated.artifact.id } : {});
      if (state.workspace?.id === requestWorkspaceId) state.workspace = workspace;
      persistLocal();
    }
    render();
  } catch (error) {
    hideTypingIndicator();
    state.failedDraft = { text: safeText, messageId: optimisticMessageId };
    addLocalMessage(workspace, 'agent', 'Не удалось получить ответ от сервера. Текст сохранен здесь, его можно скопировать и отправить повторно: «' + safeText + '»', 'Система');
    state.workspace = workspace;
    persistLocal();
    render();
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
    replaceAgentInState(state.workspace);
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
    replaceAgentInState(state.workspace);
  } else {
    const workspace = currentWorkspace();
    const result = startLocalMission(workspace, safeGoal);
    addLocalMessage(workspace, 'agent', `Backend недоступен, поэтому поручение «${result.mission.goal}» не выполнено. План сохранен как offline-черновик.`, agentDisplayName(workspace));
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
    replaceAgentInState(state.workspace);
  } else {
    const workspace = currentWorkspace();
    workspace.name = String(payload.name || '').trim() || workspace.name;
    workspace.title = String(payload.role || '').trim() || 'Личный рабочий агент';
    workspace.agentConfig = {
      ...(workspace.agentConfig || {}),
      name: String(payload.name || '').trim(),
      role: String(payload.role || '').trim(),
      instructions: String(payload.instructions || '').trim(),
      setupDone: Boolean(payload.name || payload.role || payload.instructions)
    };
    state.workspace = workspace;
    replaceAgentInState(state.workspace);
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
    replaceAgentInState(state.workspace);
  } else {
    const workspace = currentWorkspace();
    workspace.tasks = [];
    workspace.messages = [];
    workspace.missions = [];
    workspace.artifacts = [];
    workspace.agentConfig = { name: '', role: '', instructions: '', memoryNotes: [], setupDone: false };
    workspace.mode = 'execute';
    state.workspace = workspace;
    persistLocal();
  }
  state.currentView = 'settings';
  render();
}

function findArtifact(workspace, artifactId) {
  return (workspace.artifacts || []).find((artifact) => artifact.id === artifactId) || null;
}

function findMessage(workspace, messageId) {
  return (workspace.messages || []).find((message) => message.id === messageId) || null;
}

async function copyText(text, fallbackLabel) {
  const value = String(text || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  window.prompt(fallbackLabel || 'Скопируйте текст', value);
  return true;
}

async function copyArtifact(artifact) {
  if (!artifact) return;
  const text = artifact.content || artifact.summary || artifact.title || '';
  try {
    await copyText(text, 'Скопируйте текст');
    announceStatus('Материал скопирован');
  } catch {
    announceStatus('Не удалось скопировать материал');
  }
}

function downloadArtifact(artifact) {
  if (!artifact) return;
  let content = artifact.content || artifact.summary || artifact.title || '';
  if (artifact.contentEncoding === 'base64' && artifact.content) {
    const binary = atob(artifact.content);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    content = bytes;
  }
  const blob = new Blob([content], { type: artifactMimeType(artifact) });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifactFileName(artifact);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  announceStatus('Файл скачан');
}

async function setTaskStatus(taskId, status) {
  if (!state.currentUser) return;
  if (state.apiAvailable) {
    const result = await apiRequest('/api/tasks/' + taskId, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    state.workspace = result.workspace;
    replaceAgentInState(state.workspace);
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
  el.userSelect.addEventListener('input', clearPasswordError);

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

  el.demoFill.addEventListener('click', async () => {
    el.userSelect.value = demoUsers[0].id;
    el.password.value = demoUsers[0].password;
    clearPasswordError();
    await loginUser(demoUsers[0].id, demoUsers[0].password);
    render();
  });

  el.promptCancel?.addEventListener('click', () => {
    el.promptModal.close('cancel');
  });

  el.logoutBtn.addEventListener('click', () => {
    logoutUser();
  });

  el.sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!state.sidebarCollapsed);
  });

  el.sideNavToggle.addEventListener('click', () => {
    setSidebarCollapsed(!state.sidebarCollapsed);
  });

  el.sidebarBackdrop.addEventListener('click', () => {
    setSidebarCollapsed(true);
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

  window.addEventListener('resize', () => {
    if (window.matchMedia('(max-width: 1100px)').matches && !state.sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
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

  el.dashboard.addEventListener('click', (event) => {
    const copyMessageButton = event.target.closest('[data-message-copy]');
    if (copyMessageButton) {
      const workspace = currentWorkspace();
      const message = workspace ? findMessage(workspace, copyMessageButton.dataset.messageCopy) : null;
      if (!message) return;
      copyText(message.text || '', 'Скопируйте ответ').then(() => {
        copyMessageButton.textContent = '✓';
        copyMessageButton.classList.add('copied');
        setTimeout(() => {
          copyMessageButton.textContent = '⧉';
          copyMessageButton.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        announceStatus('Не удалось скопировать ответ');
      });
      return;
    }

    const downloadButton = event.target.closest('[data-artifact-download]');
    if (downloadButton) {
      const workspace = currentWorkspace();
      if (workspace) downloadArtifact(findArtifact(workspace, downloadButton.dataset.artifactDownload));
      return;
    }

    const requestButton = event.target.closest('[data-empty-request]');
    if (requestButton) {
      el.messageInput.value = requestButton.dataset.emptyRequest || '';
      state.currentView = 'chat';
      renderViewState();
      el.messageInput.focus();
      return;
    }

    if (event.target.closest('[data-empty-task]')) {
      openTaskPrompt();
      return;
    }

    if (event.target.closest('[data-empty-mission]')) {
      openMissionPrompt();
      return;
    }

    const nextButton = event.target.closest('[data-next-view], [data-next-intent]');
    if (!nextButton) return;
    const nextView = nextButton.dataset.nextView;
    const nextIntent = nextButton.dataset.nextIntent;
    if (nextView) {
      state.currentView = nextView;
      renderViewState();
      renderAuthState();
      return;
    }
    if (nextIntent === 'mission') {
      openMissionPrompt();
      return;
    }
    if (nextIntent === 'example') {
      el.messageInput.value = exampleRequests[0];
      state.currentView = 'chat';
      renderViewState();
      el.messageInput.focus();
    }
  });

  const submitCurrentMessage = async () => {
    const message = el.messageInput.value.trim();
    if (!message) return;
    await sendMessage(message);
  };

  el.composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitCurrentMessage();
  });

  el.sendBtn.addEventListener('click', async () => {
    await submitCurrentMessage();
  });

  el.messageInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await submitCurrentMessage();
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

  el.agentList?.addEventListener('click', async (event) => {
    const selectButton = event.target.closest('[data-agent-select]');
    const archiveButton = event.target.closest('[data-agent-archive]');
    if (selectButton) {
      await selectAgent(selectButton.dataset.agentSelect);
      return;
    }
    if (archiveButton) {
      await archiveAgent(archiveButton.dataset.agentArchive);
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
    openTaskPrompt();
  });

  el.newMissionBtn.addEventListener('click', () => {
    openMissionPrompt();
  });

  el.newAgentBtn?.addEventListener('click', () => {
    openAgentPrompt();
  });

  el.promptModal.addEventListener('close', async () => {
    if (el.promptModal.returnValue !== 'ok' || (!state.pendingTask && !state.pendingMission && !state.pendingAgent)) {
      state.pendingTask = false;
      state.pendingMission = false;
      state.pendingAgent = false;
      return;
    }

    const value = (state.pendingMission ? el.promptTextarea.value : el.promptInput.value).trim();
    if (!value) {
      state.pendingTask = false;
      state.pendingMission = false;
      state.pendingAgent = false;
      return;
    }
    if (state.pendingAgent) {
      state.pendingAgent = false;
      state.pendingMission = false;
      state.pendingTask = false;
      await createAgent(value);
      return;
    }
    if (state.pendingMission) {
      state.pendingMission = false;
      state.pendingTask = false;
      state.pendingAgent = false;
      await createMission(value);
      return;
    }
    state.pendingTask = false;
    state.pendingAgent = false;
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
