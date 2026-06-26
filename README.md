# AgentHub MVP

Employee-only AI workspace with a Node backend and a Vercel frontend.

What is included:
- 2 demo accounts
- each user gets a separate workspace
- each workspace has its own agent, chat, tasks, and workflow
- backend API with Postgres persistence
- frontend fallback mode for static hosting

Demo credentials:

- `Сергей / demo`
- `Марина / demo`

## Backend

Runs on the VPS with Docker Compose:

- Postgres database
- Node API container
- session cookie auth

## Frontend

Deploy on Vercel.
The frontend sends `/api/*` to the VPS through Vercel rewrites.

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

- The backend stores data in Postgres.
- Static fallback still works if you open the site without the backend, but the real production setup is VPS + Vercel.
