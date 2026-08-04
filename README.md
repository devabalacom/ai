# AgentHub

Employee-only AI assistant workspace with a single VPS deployment.

Included:
- 2 employee accounts
- separate workspace per user
- own OpenClaw workflow assistant, chat, tasks, поручения, and готовые материалы
- isolated per-user environment: chat history, tasks, поручения, materials, and agent settings do not mix
- backend API with Postgres
- frontend served from the same VPS through nginx
- per-agent files live in agents/<user>/

Employee accounts:
- support / Алина
- sales / Дамир

Initial passwords are not stored in the repository. For a fresh environment, set
`SUPPORT_INITIAL_PASSWORD` and `SALES_INITIAL_PASSWORD` before the first backend
startup. Existing user passwords are never overwritten during startup.

Deployment model:
- web container: nginx + static frontend
- api container: Node backend
- db container: Postgres
- one domain, one origin, no CORS issues

Workflow layer:
- The backend now uses OpenClaw workflow files per user.
- The agent brain is OpenClaw Gateway, expected to run on the same VPS as the app.
- AgentHub handles employee login/accounts; authenticated users send work to OpenClaw through the backend.
- If OPENCLAW_GATEWAY_URL is set, the backend can call an OpenClaw Gateway.
- OPENCLAW_MODEL selects the model exposed by OpenClaw Gateway; use it for the OpenAI-backed model.
- If no gateway is configured, the backend falls back to local workflow logic so chat and поручения still work.

Optional environment variables:
- WORKFLOW_PROVIDER (default: openclaw)
- OPENCLAW_GATEWAY_URL
- OPENCLAW_GATEWAY_TOKEN
- OPENCLAW_GATEWAY_PASSWORD
- OPENCLAW_MODEL (default: openclaw/default)
- OPENAI_API_KEY (required for real image generation)
- OPENAI_IMAGE_MODEL (default: gpt-image-1)
- OPENAI_IMAGE_SIZE (default: 1024x1024)
- SUPPORT_INITIAL_PASSWORD
- SALES_INITIAL_PASSWORD
- MAX_BODY_BYTES

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
- POST /api/missions
- POST /api/agent-settings
- POST /api/workspace/reset
- POST /api/workspace/mode
- POST /api/tasks
- PATCH /api/tasks/:id

Notes:
- Data is stored in Postgres.
- Frontend and backend run on one origin in the same compose stack.
- Agent persona, user profile, memory, and workflow text are loaded from agents/<user>/*.md.
