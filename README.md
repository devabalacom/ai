# AgentHub MVP

Минимальный employee-only прототип внутренней AI-панели.

Что есть:
- 2 demo-аккаунта
- у каждого пользователя свой workspace
- у каждого workspace свой агент
- только личный чат, задачи и workflow
- без provider-панели, owner-экрана и лишних данных

Demo credentials:

- `Сергей / demo`
- `Марина / demo`

Это статический frontend-mock. В реальном продукте сюда отдельно подключаются backend, auth, storage и LLM-provider.

## Поведение

1. Сотрудник входит в свой аккаунт.
2. Видит только свой чат, свои задачи и свой workflow.
3. Все сообщения и задачи принадлежат только его workspace.
4. Агент создаётся системой и работает без ручной настройки API со стороны пользователя.

## GitHub Pages

1. Открой Settings -> Pages.
2. В Build and deployment выбери GitHub Actions.
3. Сделай push в main или запусти workflow вручную из Actions.
