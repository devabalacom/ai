const STORAGE_KEY = 'agenthub-client-state-v2';
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
    mode: 'approve',
    model: 'Рабочий агент',
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
    model: 'Рабочий агент',
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
  { title: 'Дать цель', text: 'Запусти поручение: опиши результат, который агент должен подготовить автономно.' },
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
  'Найди свежую информацию и дай короткий вывод',
  'Запусти поручение: разобрать задачу и собрать план',
  'Создай задачу: проверить доступы завтра утром'
];

const quickActionLabels = [
  { pattern: /интернет|свеж/i, label: 'Поиск' },
  { pattern: /изображ/i, label: 'Изображение' },
  { pattern: /поручение|follow-up|тикет/i, label: 'Поручение' },
  { pattern: /статус/i, label: 'Статус' }
];

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
  mission: 'Результат поручения',
  image: 'Изображение'
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
  failedDraft: null,
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
  backendStatus: document.getElementById('backend-status'),
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

function artifactFileName(artifact) {
  return artifact?.downloadName || (String(artifact?.title || 'agenthub-file').replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'agenthub-file') + (artifact?.type === 'image' ? '.svg' : '.txt');
}

function artifactMimeType(artifact) {
  return artifact?.mimeType || (artifact?.type === 'image' ? 'image/svg+xml' : 'text/plain;charset=utf-8');
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

function quickActionLabel(text) {
  const value = String(text || '');
  return quickActionLabels.find((item) => item.pattern.test(value))?.label || value;
}

function backendStatusText() {
  if (state.apiAvailable) return 'Подключено к рабочему серверу. Данные сохраняются в вашем личном окружении.';
  if (DEMO_MODE) return 'Демо-режим: данные сохраняются только в этом браузере.';
  return 'Сервер недоступен: включен локальный режим для проверки интерфейса.';
}

function nextStep(workspace) {
  const agentConfig = workspace.agentConfig || {};
  if (!agentConfig.setupDone) {
    return {
      title: 'Сначала настройте помощника',
      text: 'Укажите имя, роль и правила работы. После этого сотруднику проще понять, что агент делает сам, а где ждет подтверждения.',
      action: 'Настроить',
      view: 'settings'
    };
  }
  if (!(workspace.missions || []).length && !(workspace.tasks || []).length && !(workspace.artifacts || []).length) {
    return {
      title: 'Лучший старт - первое поручение',
      text: 'Поручение подходит для результата: план, черновик ответа, поиск, анализ или подготовка материала.',
      action: 'Запустить поручение',
      intent: 'mission'
    };
  }
  const runningMissions = (workspace.missions || []).filter((mission) => mission.status === 'running').length;
  if (runningMissions) {
    return {
      title: 'Есть поручение в работе',
      text: 'Откройте раздел поручений, чтобы увидеть план, прогресс и связанный готовый материал.',
      action: 'Открыть поручения',
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
    text: 'Напишите коротко, что нужно получить. Если нужен результат с планом, запускайте поручение.',
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
  el.promptTitle.textContent = 'Новое поручение помощнику';
  el.promptLabel.textContent = 'Какой результат нужно подготовить?';
  el.promptInput.placeholder = 'Например: разобрать тикет и подготовить черновик ответа';
  el.promptInput.value = '';
  el.promptHelp.textContent = 'Поручение подходит для работы с результатом: план, анализ, черновик, поиск или материал.';
  el.promptSubmit.textContent = 'Запустить поручение';
  state.pendingTask = false;
  state.pendingMission = true;
  el.promptModal.showModal();
}

function openTaskPrompt() {
  el.promptTitle.textContent = 'Новая задача';
  el.promptLabel.textContent = 'Что нужно не забыть?';
  el.promptInput.placeholder = 'Например: ответить клиенту по доступам';
  el.promptInput.value = '';
  el.promptHelp.textContent = 'Задача - это напоминание или ручной следующий шаг. Для работы с результатом лучше поручение.';
  el.promptSubmit.textContent = 'Добавить задачу';
  state.pendingTask = true;
  state.pendingMission = false;
  el.promptModal.showModal();
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
  el.sideNavToggle?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  el.sideNavToggle?.setAttribute('aria-label', state.sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню');
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  renderAuthState();
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
  if (el.backendStatus) el.backendStatus.textContent = backendStatusText();
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
  el.chatSubtitle.textContent = 'Чат - для быстрых вопросов. Поручение - для результата с планом и материалом.';
  el.modeHelp.textContent = modeDescription(workspace.mode);
  el.todaySummary.innerHTML = `
    <div><strong>${openTasks}</strong><span>открытые задачи</span></div>
    <div><strong>${runningMissions}</strong><span>поручения в работе</span></div>
    <div><strong>${artifactCount}</strong><span>готовые материалы</span></div>
  `;
  renderNextStep(workspace);
  el.agentName.value = agentConfig.name || '';
  el.agentRole.value = agentConfig.role || '';
  el.agentInstructions.value = agentConfig.instructions || '';

  const modes = ['answer', 'suggest', 'approve', 'execute'];
  el.modeSwitch.innerHTML = modes.map((mode) => `
    <button class="mode-chip ${mode === workspace.mode ? 'active' : ''}" data-mode="${mode}" type="button">${escapeHtml(modeLabel(mode))}</button>
  `).join('');

  el.quickActions.innerHTML = workspace.quickActions.map((item) => `
    <button class="quick-chip" type="button" data-quick="${escapeHtml(item)}" title="${escapeHtml(item)}">${escapeHtml(quickActionLabel(item))}</button>
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
      ${renderArtifactAttachment(findArtifact(workspace, message.artifactId))}
    </article>
  `}).join('') : `
    <div class="empty-state">
      <strong>Начните с понятного запроса</strong>
      <p>Можно написать вопрос в чат или запустить поручение, если нужен готовый результат.</p>
      <div class="empty-actions">
        ${exampleRequests.map((request) => `<button class="quick-chip" type="button" data-empty-request="${escapeHtml(request)}">${escapeHtml(request)}</button>`).join('')}
      </div>
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
  `).join('') : '<div class="empty-state"><strong>Задач пока нет</strong><p>Задачи нужны для ручных следующих шагов. Если нужен готовый результат, запускайте поручение.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-task>Добавить задачу</button><button class="quick-chip" type="button" data-empty-mission>Запустить поручение</button></div></div>';

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
  `).join('') : '<div class="empty-state"><strong>Поручений пока нет</strong><p>Поручение - это автономная работа помощника: цель, план, прогресс и результат.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-mission>Запустить поручение</button></div></div>';

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
        <button type="button" data-artifact-download="${escapeHtml(artifact.id)}">Скачать файл</button>
        <button type="button" data-artifact-copy="${escapeHtml(artifact.id)}">Скопировать</button>
        <button type="button" data-artifact-task="${escapeHtml(artifact.id)}">Создать задачу</button>
      </div>
    </article>
  `).join('') : '<div class="empty-state"><strong>Готовых материалов пока нет</strong><p>Здесь будут черновики, ответы, изображения и результаты поручений, которые можно раскрыть и скопировать.</p><div class="empty-actions"><button class="quick-chip" type="button" data-empty-mission>Создать первый материал</button></div></div>';

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

function isImageRequest(message) {
  const lower = String(message || '').toLowerCase();
  if (/картин|изображ|иллюстрац|image|picture|photo|svg/.test(lower)) return true;
  return /(сгенер|генерир|нарису|рису|создай|сделай|generate|draw|create).*(кот|кота|кошк|cat|портрет|логотип|баннер|иконк)/.test(lower);
}

function generateReply(workspace, message) {
  const lower = message.toLowerCase();

  if (isImageRequest(message)) {
    return {
      text: 'Сервер сейчас недоступен, поэтому я не могу запустить реальную генерацию изображения. Подключитесь к рабочему серверу и отправьте запрос еще раз.'
    };
  }

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

  return 'Принял. Могу отвечать, искать, создавать задачи и вести твое личное рабочее пространство.';
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
      const users = await apiRequest('/api/users', { allowUnauthorized: true });
      if (Array.isArray(users) && users.length) {
        state.users = users;
        return;
      }
    } catch {
      // Keep demo users as a safe fallback for local checks.
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
  const workspace = currentWorkspace();
  if (!workspace) return;
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
      state.workspace = result.workspace;
    } else {
      showTypingIndicator();
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      const generated = generateReply(workspace, safeText);
      const reply = typeof generated === 'string' ? generated : generated.text;
      hideTypingIndicator();
      addLocalMessage(workspace, 'agent', reply, agentDisplayName(workspace), generated.artifact ? { artifactId: generated.artifact.id } : {});
      state.workspace = workspace;
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

function downloadArtifact(artifact) {
  if (!artifact) return;
  const blob = new Blob([artifact.content || artifact.summary || artifact.title || ''], { type: artifactMimeType(artifact) });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifactFileName(artifact);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
