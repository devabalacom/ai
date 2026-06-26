# AgentHub MVP

Статический прототип внутренней AI-панели с центральным provider layer:

- логин по demo-аккаунтам
- каждый сотрудник = отдельный пользователь сервиса
- у каждого пользователя = свой workspace
- у каждого workspace = свой агент
- персональные агенты
- чат
- режимы answer / suggest / approve / execute
- задачи, память, аудит

Открывается как обычная статическая страница.

Demo credentials:

- `Joni / demo`
- `Сергей / demo`
- `Марина / demo`
- `Олег / demo`

Это frontend-mock. Backend, auth, хранение и реальные интеграции нужно подключать отдельно.

## Сущности

- Tenant - компания
- User - сотрудник
- Workspace - личное рабочее пространство
- Agent - персональный ассистент сотрудника
- Conversation - чат с агентом
- Task - очередь действий
- Memory - долгоживущая память
- AuditLog - журнал действий

## Onboarding flow

1. Owner добавляет сотрудника в админке.
2. Provider автоматически создаёт workspace and agent.
3. Сотрудник получает логин и входит в свой чат.
4. Все LLM-вызовы идут через центральный provider layer.
5. Сотрудник пишет в чат, как в Telegram, без API и без ручной настройки.

## Screens

- Login
- Employee workspace
- Owner dashboard
- Agent detail
- Tasks and memory
- Audit log

## GitHub Pages

1. Открой Settings -> Pages.
2. В Build and deployment выбери GitHub Actions.
3. Сделай push в main или запусти workflow вручную из Actions.
4. После деплоя сайт будет доступен по адресу Pages, который покажет GitHub.


Сценарий MVP: owner создаёт агента сотрудника, а сотрудник потом просто пишет в чат как в Telegram.
