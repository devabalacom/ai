const STORAGE_KEY = 'agenthub-mvp-state-v2';

const demoUsers = [
  { id: 'sergey', name: 'Сергей', title: 'Support lead', password: 'demo', agentId: 'sergey-agent' },
  { id: 'marina', name: 'Марина', title: 'Sales lead', password: 'demo', agentId: 'marina-agent' }
];

const initialAgents = {
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
  currentUser: null,
  currentAgentId: 'sergey-agent',
  agents: structuredClone(initialAgents),
  pendingTask: false
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
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function currentAgent() {
  return state.agents[state.currentAgentId];
}

function addMessage(role, text, author = role === 'user' ? state.currentUser.name : `Агент ${currentAgent().name}`) {
  currentAgent().messages.push({ id: crypto.randomUUID(), role, author, time: now(), text });
}

function addTask(title, details) {
  currentAgent().tasks.unshift({
    id: crypto.randomUUID(),
    title,
    details,
    status: 'todo'
  });
  currentAgent().tasks = currentAgent().tasks.slice(0, 8);
}

function setAgentMode(mode) {
  currentAgent().mode = mode;
  render();
  persist();
}

function renderAuthState() {
  const loggedIn = Boolean(state.currentUser);
  el.authCard.classList.toggle('hidden', loggedIn);
  el.dashboard.classList.toggle('hidden', !loggedIn);
}

function renderUserSelect() {
  el.userSelect.innerHTML = demoUsers.map((user) => `<option value="${user.id}">${user.name} · ${user.title}</option>`).join('');
  if (!el.userSelect.value && demoUsers[0]) {
    el.userSelect.value = demoUsers[0].id;
  }
}

function renderHeader() {
  const agent = currentAgent();
  el.profileName.textContent = state.currentUser.name;
  el.profileMeta.textContent = `${state.currentUser.title} · личное пространство`;
  el.workspaceTitle.textContent = `${agent.name} · ${agent.title}`;
  el.workspaceHint.textContent = 'Сотрудник видит только свой чат, свои задачи и свой workflow.';
  el.modelLabel.textContent = agent.model;
  el.modeLabel.textContent = agent.mode;
  el.taskCount.textContent = String(agent.tasks.filter((task) => task.status !== 'done').length);
  el.chatSubtitle.textContent = 'Личный чат сотрудника и его агента.';
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

function renderWorkflow() {
  const agent = currentAgent();
  const workflow = [
    { label: 'Current mode', value: agent.mode },
    { label: 'Open tasks', value: String(agent.tasks.filter((task) => task.status !== 'done').length) },
    { label: 'Chat history', value: String(agent.messages.length) },
    { label: 'Agent', value: agent.name }
  ];

  el.workflowGrid.innerHTML = workflow.map((item) => `
    <div class="workflow-card">
      <div class="workflow-label">${item.label}</div>
      <div class="workflow-value">${item.value}</div>
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
  renderHeader();
  renderModes();
  renderQuickActions();
  renderMessages();
  renderTasks();
  renderWorkflow();
  persist();
}

function processUserMessage(message) {
  const agent = currentAgent();
  addMessage('user', message, state.currentUser.name);

  const lower = message.toLowerCase();
  let reply = '';

  if (/задач|task|сделай/.test(lower)) {
    const title = message.replace(/создай|сделай|задачу|task/gi, '').trim() || 'Новая задача';
    addTask(title, 'Создано из чата.');
    reply = agent.mode === 'execute'
      ? `Готово: задача «${title}» добавлена.`
      : `Могу добавить задачу «${title}». Подтверди, если ок.`;
  } else if (/прайс|цена|документ|найди|поиск/.test(lower)) {
    reply = 'Понял. В MVP это мок-поиск: найду релевантный шаблон, прайс или документ в личной базе.';
  } else if (/статус|блок|риск/.test(lower)) {
    reply = 'Вижу текущий статус: есть открытые задачи и один блокер, если он есть в твоей очереди.';
  } else if (/привет|hello|hi/.test(lower)) {
    reply = agent.mode === 'answer'
      ? 'На связи. Пиши вопрос, задачу или короткую команду.'
      : 'Готов. Могу предложить решение, спланировать шаги или выполнить безопасный сценарий.';
  } else if (agent.mode === 'suggest') {
    reply = 'Сначала соберу контекст, потом предложу черновик и только затем действие.';
  } else if (agent.mode === 'execute') {
    reply = 'Выполняю безопасный сценарий и фиксирую результат в текущем workspace.';
  } else {
    reply = 'Принял. Могу отвечать, искать, создавать задачи и вести твой личный workflow.';
  }

  addMessage('agent', reply, `Агент ${agent.name}`);
  render();
}

function sendCurrentMessage() {
  const message = el.messageInput.value.trim();
  if (!message) return;
  processUserMessage(message);
  el.messageInput.value = '';
  el.messageInput.focus();
}

function bindEvents() {
  const clearPasswordError = () => el.password.setCustomValidity('');

  el.password.addEventListener('input', clearPasswordError);
  el.userSelect.addEventListener('change', clearPasswordError);

  el.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = demoUsers.find((item) => item.id === el.userSelect.value);
    if (!user || el.password.value !== user.password) {
      el.password.setCustomValidity('Неверный demo-пароль');
      el.password.reportValidity();
      return;
    }

    el.password.setCustomValidity('');
    state.currentUser = user;
    state.currentAgentId = user.agentId;
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
    sendCurrentMessage();
  });

  el.sendBtn.addEventListener('click', () => {
    sendCurrentMessage();
  });

  el.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage();
    }
  });

  el.taskList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-task-id][data-task-status]');
    if (!button) return;
    const task = currentAgent().tasks.find((item) => item.id === button.dataset.taskId);
    if (!task) return;
    task.status = button.dataset.taskStatus;
    render();
  });

  el.newTaskBtn.addEventListener('click', () => {
    el.promptTitle.textContent = 'Новая задача';
    el.promptLabel.textContent = 'Название';
    el.promptInput.value = '';
    state.pendingTask = true;
    el.promptModal.showModal();
  });

  el.promptModal.addEventListener('close', () => {
    if (el.promptModal.returnValue !== 'ok' || !state.pendingTask) {
      state.pendingTask = false;
      return;
    }

    const value = el.promptInput.value.trim();
    state.pendingTask = false;
    if (!value) return;

    addTask(value, 'Создано вручную через панель.');
    render();
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
