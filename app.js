const STORAGE_KEY = 'agenthub-mvp-state-v1';

const aiProvider = {
  name: 'Central provider',
  model: 'GPT-5',
  delivery: 'Telegram-like chat runtime',
  role: 'LLM router and agent runtime',
  provisioning: 'Owner creates the agent, employee gets a ready-to-use chat'
};

const demoUsers = [
  { id: 'joni', name: 'Joni', role: 'owner', title: 'Owner / admin', password: 'demo', agentId: 'owner-agent' },
  { id: 'sergey', name: 'Сергей', role: 'employee', title: 'Support lead', password: 'demo', agentId: 'sergey-agent' },
  { id: 'maria', name: 'Марина', role: 'employee', title: 'Sales lead', password: 'demo', agentId: 'sales-agent' },
  { id: 'oleg', name: 'Олег', role: 'employee', title: 'Ops manager', password: 'demo', agentId: 'ops-agent' }
];

const loginAliases = new Map([
  ['joni', 'joni'],
  ['sergey', 'sergey'],
  ['сергей', 'sergey'],
  ['марина', 'maria'],
  ['maria', 'maria'],
  ['oleg', 'oleg'],
  ['олег', 'oleg']
]);

const initialAgents = {
  'owner-agent': {
    id: 'owner-agent',
    name: 'Joni',
    title: 'Стратегия и контроль',
    mode: 'approve',
    model: 'GPT-5',
    permissions: ['Чтение базы', 'Создание задач', 'Черновики ответов', 'Запрос подтверждения', 'Управление агентами'],
    quickActions: ['Найти старый договор', 'Показать риски по проекту', 'Собрать статус по команде', 'Создай onboarding checklist'],
    memory: ['Любит краткие статус-резюме.', 'Все опасные действия должны идти через подтверждение.', 'Нужно держать аудит включенным.'],
    tasks: [
      { id: 't1', title: 'Проверить доступы сотрудников', status: 'waiting', details: 'Сверить, кому можно отправлять внешние письма.' },
      { id: 't2', title: 'Подготовить описание MVP', status: 'todo', details: 'Собрать список экранов и ограничений для первой версии.' }
    ],
    messages: [
      { id: 'm1', role: 'agent', author: 'AgentHub', time: '09:02', text: 'Я на связи. Могу отвечать, собирать статусы, готовить черновики и создавать задачи.' },
      { id: 'm2', role: 'user', author: 'Joni', time: '09:03', text: 'Сделай MVP для внутреннего AI-панеля.' },
      { id: 'm3', role: 'agent', author: 'AgentHub', time: '09:03', text: 'Принял. Я бы начал с логина, отдельного агента на сотрудника, чата, памяти, задач и аудита.' }
    ],
    audit: [
      { id: 'a1', text: 'MVP workspace created from seed data.', time: '09:01' },
      { id: 'a2', text: 'Mode set to approve.', time: '09:02' }
    ]
  },
  'sergey-agent': {
    id: 'sergey-agent',
    name: 'Сергей',
    title: 'Support and internal ops',
    mode: 'answer',
    model: 'GPT-5',
    permissions: ['Чтение базы', 'Черновики ответов', 'Создание задач'],
    quickActions: ['Ответь клиенту', 'Проверь статус', 'Собери FAQ', 'Найди документ'],
    memory: ['Сотрудник не настраивает API сам.', 'Агент создаётся центральным provider-слоем.', 'Работает как личный чат в Telegram.'],
    tasks: [
      { id: 't7', title: 'Ответить на тикет по доступам', status: 'todo', details: 'Использовать готовый internal flow без ручной интеграции.' }
    ],
    messages: [
      { id: 'm10', role: 'agent', author: 'AgentHub', time: '09:10', text: 'Сергей, я уже создан. Тебе не нужно подключать API или делать настройку. Просто пиши мне сюда.' },
      { id: 'm11', role: 'user', author: 'Сергей', time: '09:11', text: 'Сделай ответ на тикет по доступам.' },
      { id: 'm12', role: 'agent', author: 'AgentHub', time: '09:11', text: 'Готовлю черновик ответа и отмечаю задачу в очередь.' }
    ],
    audit: [
      { id: 'a7', text: 'Agent provisioned by central provider.', time: '09:10' }
    ]
  },
  'sales-agent': {
    id: 'sales-agent',
    name: 'Марина',
    title: 'Продажи и коммуникации',
    mode: 'suggest',
    model: 'GPT-5',
    permissions: ['Чтение базы', 'Черновики ответов', 'Создание задач'],
    quickActions: ['Составь ответ клиенту', 'Найди прайс', 'Подготовь follow-up', 'Собери коммерческое'],
    memory: ['Нельзя обещать сроки без подтверждения производства.', 'Клиентам нужен короткий, уверенный стиль.', 'Часто просит сравнить варианты.'],
    tasks: [
      { id: 't3', title: 'Ответить на запрос по срокам', status: 'todo', details: 'Нужно проверить, есть ли подтвержденные даты по отгрузке.' },
      { id: 't4', title: 'Подготовить follow-up клиенту', status: 'done', details: 'Черновик отправлен на согласование.' }
    ],
    messages: [
      { id: 'm4', role: 'agent', author: 'AgentHub', time: '08:50', text: 'Я помогу собрать ответ клиенту, но сначала проверю, есть ли подтвержденные сроки.' },
      { id: 'm5', role: 'user', author: 'Марина', time: '08:52', text: 'Сделай короткий ответ по прайсу и срокам.' },
      { id: 'm6', role: 'agent', author: 'AgentHub', time: '08:52', text: 'Готовлю черновик: прайс пришлю отдельно, по срокам отвечу после сверки с производством.' }
    ],
    audit: [
      { id: 'a3', text: 'Draft reply generated for client.', time: '08:52' },
      { id: 'a4', text: 'Pricing lookup requested.', time: '08:53' }
    ]
  },
  'ops-agent': {
    id: 'ops-agent',
    name: 'Олег',
    title: 'Операции и исполнение',
    mode: 'execute',
    model: 'GPT-5',
    permissions: ['Чтение базы', 'Создание задач', 'Исполнение безопасных действий', 'Запрос подтверждения для рискованных действий'],
    quickActions: ['Открой статус задач', 'Создай заявку на закупку', 'Проверь блокеры', 'Покажи лог ошибок'],
    memory: ['Операционные действия требуют подтверждения на письма и удаления.', 'Любую закупку нужно логировать.', 'Сначала статус, потом действие.'],
    tasks: [
      { id: 't5', title: 'Проверить блокирующие задачи', status: 'blocked', details: 'Нужна верификация по внешней поставке.' },
      { id: 't6', title: 'Собрать список открытых заявок', status: 'todo', details: 'Поднять только активные заявки за последние 7 дней.' }
    ],
    messages: [
      { id: 'm7', role: 'agent', author: 'AgentHub', time: '08:41', text: 'Я могу выполнять безопасные операции автоматически. Рискованные действия буду ставить на подтверждение.' },
      { id: 'm8', role: 'user', author: 'Олег', time: '08:42', text: 'Покажи, что заблокировано прямо сейчас.' },
      { id: 'm9', role: 'agent', author: 'AgentHub', time: '08:42', text: 'Есть один блокер: внешняя поставка не подтверждена. Могу создать задачу на проверку.' }
    ],
    audit: [
      { id: 'a5', text: 'Blocked item highlighted.', time: '08:42' },
      { id: 'a6', text: 'Safe execution mode enabled.', time: '08:42' }
    ]
  }
};

const state = {
  currentUser: null,
  currentAgentId: 'owner-agent',
  agents: structuredClone(initialAgents),
  pendingPrompt: null,
  pendingConfirm: null
};

const el = {
  providerModel: document.getElementById('provider-model'),
  providerRole: document.getElementById('provider-role'),
  providerDelivery: document.getElementById('provider-delivery'),
  providerProvisioning: document.getElementById('provider-provisioning'),
  authCard: document.getElementById('auth-card'),
  dashboard: document.getElementById('dashboard'),
  loginForm: document.getElementById('login-form'),
  userSelect: document.getElementById('user-select'),
  password: document.getElementById('password'),
  demoFill: document.getElementById('demo-fill'),
  logoutBtn: document.getElementById('logout-btn'),
  profileName: document.getElementById('profile-name'),
  profileMeta: document.getElementById('profile-meta'),
  profileRole: document.getElementById('profile-role'),
  agentList: document.getElementById('agent-list'),
  permissionList: document.getElementById('permission-list'),
  workspaceTitle: document.getElementById('workspace-title'),
  modelLabel: document.getElementById('model-label'),
  modeLabel: document.getElementById('mode-label'),
  taskCount: document.getElementById('task-count'),
  chatSubtitle: document.getElementById('chat-subtitle'),
  modeSwitch: document.getElementById('mode-switch'),
  quickActions: document.getElementById('quick-actions'),
  messages: document.getElementById('messages'),
  composer: document.getElementById('composer'),
  messageInput: document.getElementById('message-input'),
  taskList: document.getElementById('task-list'),
  memoryList: document.getElementById('memory-list'),
  auditList: document.getElementById('audit-list'),
  newTaskBtn: document.getElementById('new-task-btn'),
  addMemoryBtn: document.getElementById('add-memory-btn'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmText: document.getElementById('confirm-text'),
  promptModal: document.getElementById('prompt-modal'),
  promptTitle: document.getElementById('prompt-title'),
  promptLabel: document.getElementById('prompt-label'),
  promptInput: document.getElementById('prompt-input')
};

function persist() {
  const payload = {
    currentUser: state.currentUser?.id ?? null,
    currentAgentId: state.currentAgentId,
    agents: state.agents
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved?.agents) state.agents = saved.agents;
    if (saved?.currentAgentId && state.agents[saved.currentAgentId]) state.currentAgentId = saved.currentAgentId;
    if (saved?.currentUser) state.currentUser = demoUsers.find((user) => user.id === saved.currentUser) ?? null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function now() {
  const d = new Date();
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function currentAgent() {
  return state.agents[state.currentAgentId];
}

function isOwner() {
  return state.currentUser?.role === 'owner';
}

function addAudit(text) {
  const agent = currentAgent();
  agent.audit.unshift({ id: crypto.randomUUID(), text, time: now() });
  agent.audit = agent.audit.slice(0, 8);
}

function addMessage(role, text, author = role === 'user' ? state.currentUser.name : 'AgentHub') {
  const agent = currentAgent();
  agent.messages.push({ id: crypto.randomUUID(), role, author, time: now(), text });
  if (role === 'user') {
    addAudit(`User message sent: ${text.slice(0, 60)}`);
  }
}

function addTask(title, details, status = 'todo') {
  const agent = currentAgent();
  agent.tasks.unshift({ id: crypto.randomUUID(), title, details, status });
  agent.tasks = agent.tasks.slice(0, 8);
  addAudit(`Task created: ${title}`);
}

function addMemory(entry) {
  const agent = currentAgent();
  agent.memory.unshift(entry);
  agent.memory = agent.memory.slice(0, 8);
  addAudit(`Memory fact added: ${entry}`);
}

function setAgentMode(mode) {
  currentAgent().mode = mode;
  addAudit(`Mode set to ${mode}`);
  render();
  persist();
}

function agentReply(input) {
  const agent = currentAgent();
  const text = input.toLowerCase();
  const mode = agent.mode;

  if (/удали|delete|remove|отправь|send external|напиши клиенту/.test(text)) {
    return {
      type: 'confirm',
      title: 'Требуется подтверждение',
      text: 'Это действие может затронуть внешние данные. Подтвердить выполнение?'
    };
  }

  if (/создай задачу|задачу|task/.test(text)) {
    const title = input.replace(/создай задачу|создай|task/gi, '').trim() || 'Новая задача';
    addTask(title || 'Новая задача', 'Создана из чата агентом.');
    return {
      type: 'text',
      text: mode === 'execute'
        ? `Готово: задача «${title || 'Новая задача'}» добавлена в очередь.`
        : `Предлагаю добавить задачу: «${title || 'Новая задача'}». Подтверди, если ок.`
    };
  }

  if (/найди|поиск|документ|прайс|цена/.test(text)) {
    return {
      type: 'text',
      text: 'Нашёл релевантные материалы. В MVP это мок-ответ: прайс, договор и шаблон письма доступны в базе знаний.'
    };
  }

  if (/статус|блок|риск|block/.test(text)) {
    return {
      type: 'text',
      text: 'Сейчас вижу один блокер по внешней поставке и две задачи в очереди. Могу оформить follow-up или запросить подтверждение.'
    };
  }

  if (/привет|hello|hi/.test(text)) {
    return {
      type: 'text',
      text: mode === 'answer'
        ? 'Принял. Могу ответить, искать данные, создавать задачи или запросить подтверждение на действие.'
        : 'Готов. Дай команду или вопрос, и я разберу его по режиму агента.'
    };
  }

  if (mode === 'suggest') {
    return {
      type: 'text',
      text: 'Я бы сначала собрал контекст, затем предложил черновик и только потом отправлял внешнее действие.'
    };
  }

  if (mode === 'execute') {
    return {
      type: 'text',
      text: 'Выполняю безопасный сценарий: обновил статус, записал событие в аудит и сохранил результат в памяти.'
    };
  }

  return {
    type: 'text',
    text: 'Собрал краткий ответ. Для MVP этого достаточно, дальше можно подключить API, базу знаний и реальные инструменты.'
  };
}

function renderUserSelect() {
  el.userSelect.innerHTML = demoUsers.map((user) => `<option value="${user.id}">${user.name} · ${user.title}</option>`).join('');
  if (!el.userSelect.value && demoUsers[0]) {
    el.userSelect.value = demoUsers[0].id;
  }
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  el.authCard.classList.toggle('hidden', loggedIn);
  el.dashboard.classList.toggle('hidden', !loggedIn);
}

function renderSidebar() {
  const agentEntries = isOwner()
    ? Object.values(state.agents)
    : [state.agents[state.currentUser.agentId]];

  el.agentList.innerHTML = agentEntries.map((agent) => {
    const active = agent.id === state.currentAgentId ? 'active' : '';
    return `
      <div class="agent-item ${active}" data-agent="${agent.id}">
        <div>
          <div class="agent-name">${agent.name}</div>
          <div class="profile-meta">${agent.title}</div>
        </div>
        <div class="agent-status">${agent.mode}</div>
      </div>
    `;
  }).join('');

  const agent = currentAgent();
  el.permissionList.innerHTML = agent.permissions.map((permission) => `
    <div class="permission-item">${permission}</div>
  `).join('');

  el.profileName.textContent = state.currentUser.name;
  el.profileMeta.textContent = `${state.currentUser.title} · ${state.currentUser.role}`;
  el.profileRole.textContent = `Доступ к агенту: ${agent.name}`;
}

function renderTopbar() {
  const agent = currentAgent();
  el.workspaceTitle.textContent = `${agent.name} · ${agent.title}`;
  el.modelLabel.textContent = agent.model;
  el.modeLabel.textContent = agent.mode;
  el.taskCount.textContent = agent.tasks.filter((task) => task.status !== 'done').length;
  el.chatSubtitle.textContent = isOwner()
    ? 'Owner видит всех сотрудников и может переключать агентов.'
    : 'Сотрудник видит только свой workspace и свои права.';
}

function renderModes() {
  const agent = currentAgent();
  const modes = ['answer', 'suggest', 'approve', 'execute'];
  el.modeSwitch.innerHTML = modes.map((mode) => `
    <button class="mode-chip ${mode === agent.mode ? 'active' : ''}" data-mode="${mode}" type="button">${mode}</button>
  `).join('');
}

function renderQuickActions() {
  const agent = currentAgent();
  el.quickActions.innerHTML = agent.quickActions.map((item) => `
    <button class="quick-chip" type="button" data-quick="${item}">${item}</button>
  `).join('');
}

function renderMessages() {
  const agent = currentAgent();
  el.messages.innerHTML = agent.messages.map((message) => `
    <article class="message ${message.role}">
      <div class="message-meta">
        <span>${message.author}</span>
        <span>${message.time}</span>
      </div>
      <div>${message.text}</div>
    </article>
  `).join('');
  el.messages.scrollTop = el.messages.scrollHeight;
}

function statusBadge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

function renderTasks() {
  const agent = currentAgent();
  el.taskList.innerHTML = agent.tasks.map((task) => `
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-title">${task.title}</div>
          <div class="panel-subtitle">${task.details}</div>
        </div>
        ${statusBadge(task.status)}
      </div>
      <div class="task-actions">
        <button type="button" data-task-status="todo" data-task-id="${task.id}">Todo</button>
        <button type="button" data-task-status="waiting" data-task-id="${task.id}">Waiting</button>
        <button type="button" data-task-status="done" data-task-id="${task.id}">Done</button>
      </div>
    </div>
  `).join('');
}

function renderMemory() {
  const agent = currentAgent();
  el.memoryList.innerHTML = agent.memory.map((entry) => `
    <div class="memory-item">${entry}</div>
  `).join('');
}

function renderAudit() {
  const agent = currentAgent();
  el.auditList.innerHTML = agent.audit.map((entry) => `
    <div class="audit-item">
      <div class="task-top">
        <div>${entry.text}</div>
        <div class="panel-subtitle">${entry.time}</div>
      </div>
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
  renderSidebar();
  renderProviderPanel();
  renderTopbar();
  renderModes();
  renderQuickActions();
  renderMessages();
  renderTasks();
  renderMemory();
  renderAudit();
  persist();
}

function setCurrentAgent(agentId) {
  if (!state.agents[agentId]) return;
  state.currentAgentId = agentId;
  addAudit(`Switched to agent ${agentId}`);
  render();
}

function handleAgentResponse(response, fallbackText) {
  if (response.type === 'confirm') {
    state.pendingConfirm = { text: response.text, title: response.title, fallbackText };
    el.confirmText.textContent = response.text;
    el.confirmModal.showModal();
    return;
  }

  addMessage('agent', response.text);
  addAudit('Agent replied to message.');
  render();
}

function processUserMessage(message) {
  addMessage('user', message, state.currentUser.name);
  const response = agentReply(message);
  handleAgentResponse(response, message);
}

function bindEvents() {
  const clearPasswordError = () => {
    el.password.setCustomValidity('');
  };

  el.password.addEventListener('input', clearPasswordError);
  el.userSelect.addEventListener('change', clearPasswordError);

  el.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawLogin = String(el.userSelect.value || '').trim().toLowerCase();
    const userId = loginAliases.get(rawLogin) || rawLogin;
    const user = demoUsers.find((item) => item.id === userId || item.name.toLowerCase() === rawLogin);
    if (!user || el.password.value !== user.password) {
      el.password.setCustomValidity('Неверный demo-пароль');
      el.password.reportValidity();
      return;
    }
    el.password.setCustomValidity('');
    state.currentUser = user;
    state.currentAgentId = user.agentId;
    addAudit(`User ${user.name} logged in.`);
    render();
  });

  el.demoFill.addEventListener('click', () => {
    el.userSelect.value = demoUsers[0].id;
    el.password.value = 'demo';
    clearPasswordError();
  });

  el.logoutBtn.addEventListener('click', () => {
    state.currentUser = null;
    state.currentAgentId = demoUsers[0].agentId;
    localStorage.removeItem(STORAGE_KEY);
    render();
  });

  el.agentList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-agent]');
    if (!target) return;
    if (!isOwner() && target.dataset.agent !== state.currentUser.agentId) return;
    setCurrentAgent(target.dataset.agent);
  });

  el.modeSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    setAgentMode(button.dataset.mode);
  });

  el.quickActions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick]');
    if (!button) return;
    el.messageInput.value = button.dataset.quick;
    el.messageInput.focus();
  });

  el.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = el.messageInput.value.trim();
    if (!message) return;
    processUserMessage(message);
    el.messageInput.value = '';
  });

  el.taskList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-task-id][data-task-status]');
    if (!button) return;
    const agent = currentAgent();
    const task = agent.tasks.find((item) => item.id === button.dataset.taskId);
    if (!task) return;
    task.status = button.dataset.taskStatus;
    addAudit(`Task "${task.title}" moved to ${task.status}.`);
    render();
  });

  el.newTaskBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новая задача';
    el.promptLabel.textContent = 'Название';
    el.promptInput.value = '';
    state.pendingPrompt = 'task';
    el.promptModal.showModal();
  });

  el.addMemoryBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новый факт памяти';
    el.promptLabel.textContent = 'Факт';
    el.promptInput.value = '';
    state.pendingPrompt = 'memory';
    el.promptModal.showModal();
  });

  el.promptModal.addEventListener('close', () => {
    if (el.promptModal.returnValue !== 'ok') {
      state.pendingPrompt = null;
      return;
    }
    const value = el.promptInput.value.trim();
    if (!value) {
      state.pendingPrompt = null;
      return;
    }
    if (state.pendingPrompt === 'task') {
      addTask(value, 'Создано вручную через панель.');
    } else if (state.pendingPrompt === 'memory') {
      addMemory(value);
    }
    state.pendingPrompt = null;
    render();
  });

  el.confirmModal.addEventListener('close', () => {
    if (el.confirmModal.returnValue !== 'ok' || !state.pendingConfirm) {
      state.pendingConfirm = null;
      return;
    }
    const responseText = 'Подтверждено. В MVP я бы передал это в backend-очередь и зафиксировал действие в аудит.';
    addMessage('agent', responseText);
    addAudit('Confirmed high-risk action.');
    state.pendingConfirm = null;
    render();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      state.pendingPrompt = null;
    }
  });
}

function bootstrap() {
  restore();
  renderUserSelect();
  bindEvents();

  if (state.currentUser) {
    render();
    return;
  }

  renderAuthState();
}

bootstrap();
