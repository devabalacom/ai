# AgentHub MVP

Employee-only AI workspace with a single VPS deployment.

Included:
- 2 demo accounts
- separate workspace per user
- own agent, chat, tasks, workflow
- backend API with Postgres
- frontend served from the same VPS through nginx

Demo credentials:
- Сергей / demo
- Марина / demo

Deployment model:
- web container: nginx + static frontend
- api container: Node backend
- db container: Postgres
- one domain, one origin, no CORS issues

LLM chat:
- If OPENAI_API_KEY is set in the VPS environment, the chat replies via OpenAI.
- If the key is missing, the backend falls back to built-in demo reply logic.

Optional environment variables:
- OPENAI_API_KEY
- OPENAI_MODEL (default: gpt-4o-mini)

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
