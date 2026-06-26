# AgentHub MVP

Employee-only AI workspace with a small Node backend.

What is included:
- 2 demo accounts
- each user gets a separate workspace
- each workspace has its own agent, chat, tasks, and workflow
- backend API with login, messages, tasks, and mode updates
- frontend fallback mode for static hosting

Demo credentials:

- `Сергей / demo`
- `Марина / demo`

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## API

- `GET /api/health`
- `GET /api/users`
- `GET /api/me`
- `POST /api/login`
- `POST /api/logout`
- `POST /api/message`
- `POST /api/workspace/mode`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`

## Notes

- The backend stores state in `data/state.json`.
- GitHub Pages can still host the static fallback, but the real backend runs via Node.
