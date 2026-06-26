# AgentHub MVP

Employee-only AI workspace with a single VPS deployment.

What is included:
- 2 demo accounts
- each user gets a separate workspace
- each workspace has its own agent, chat, tasks, and workflow
- backend API with Postgres persistence
- frontend served from the same VPS through nginx

Demo credentials:

- `Сергей / demo`
- `Марина / demo`

## Deployment model

- `web` container: nginx + static frontend
- `api` container: Node backend
- `db` container: Postgres
- one domain, one origin, no CORS issues

## Run locally

```bash
docker compose up --build
```

Open:

```text
http://localhost
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

- The backend stores data in Postgres.
- The frontend is served by nginx in the same compose stack, so the browser talks to one origin only.
