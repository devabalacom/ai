# AgentHub MVP

Статический прототип внутренней AI-панели с центральным provider layer:

- логин по demo-аккаунтам
- персональные агенты
- чат
- режимы `answer / suggest / approve / execute`
- задачи, память, аудит

Открывается как обычная статическая страница.

Demo credentials:

- `Joni / demo`
- `Сергей / demo`
- `Марина / demo`
- `Олег / demo`

Это frontend-mock. Backend, auth, хранение и реальные интеграции нужно подключать отдельно.

## GitHub Pages

1. Открой Settings -> Pages.
2. В Build and deployment выбери GitHub Actions.
3. Сделай push в main или запусти workflow вручную из Actions.
4. После деплоя сайт будет доступен по адресу Pages, который покажет GitHub.


Сценарий MVP: owner создаёт агента сотрудника, а сотрудник потом просто пишет в чат как в Telegram.
