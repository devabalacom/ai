# AgentHub MVP

Employee-only AI workspace with a single VPS deployment.

Included:
- 2 demo accounts
- separate workspace per user
- own OpenClaw workflow agent, chat, tasks, workflow
- backend API with Postgres
- frontend served from the same VPS through nginx
- per-agent files live in agents/<user>/

Demo credentials:
- Сергей / demo
- Марина / demo

Deployment model:
- web container: nginx + static frontend
- api container: Node backend
- db container: Postgres
- one domain, one origin, no CORS issues

Workflow layer:
- The backend now uses OpenClaw workflow files per user.
- If OPENCLAW_GATEWAY_URL is set, the backend can call an OpenClaw Gateway.
- If no gateway is configured, the backend falls back to local workflow logic so chat still works.

Optional environment variables:
- WORKFLOW_PROVIDER (default: openclaw)
- OPENCLAW_GATEWAY_URL
- OPENCLAW_GATEWAY_TOKEN
- OPENCLAW_GATEWAY_PASSWORD

Run locally:
- docker compose up --build
- open http://localhost

API:
- GET /api/health
- GET /api/users
- GET /api/me
- POST /api/login
- POST /api/logout
- POST /api/message
- POST /api/workspace/mode
- POST /api/tasks
- PATCH /api/tasks/:id

Notes:
- Data is stored in Postgres.
- Frontend and backend run on one origin in the same compose stack.
- Agent persona, user profile, memory, and workflow text are loaded from agents/<user>/*.md.
