# Bug Tracking SaaS

Full-stack Jira-like bug tracking and project management app with:

- `frontend/`: React + Vite + Tailwind
- `backend/`: Express + Mongoose API
- `deploy/mongo/`: MongoDB image and repo-local backup restore assets
- `docs/`: project documentation and API/flow guide
- `docker-compose.yml`: production-style local deployment

## Deployment Structure

```text
.
|-- backend/
|   |-- Dockerfile
|   |-- .dockerignore
|   |-- .env.example
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   |-- scripts/
|   |   `-- exportMongoBackup.js
|   |-- services/
|   |-- utils/
|   `-- server.js
|-- frontend/
|   |-- Dockerfile
|   |-- .dockerignore
|   |-- .env.example
|   |-- nginx.conf
|   `-- src/
|-- deploy/
|   `-- mongo/
|       |-- Dockerfile
|       |-- restore.js
|       `-- backup/
|           `-- bugtracker/
|               |-- manifest.json
|               |-- users.json
|               |-- projects.json
|               |-- issues.json
|               `-- ...
|-- docs/
|   `-- PROJECT_API_AND_FLOW.md
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## What Is Included

- Docker image for the backend API
- Docker image for the frontend with Nginx
- Docker image for MongoDB with first-run restore support
- Exported Mongo backup snapshot from the current local `bugtracker` database
- Compose-based local deployment flow

## Documentation

- [README.md](README.md): setup and deployment
- [docs/PROJECT_API_AND_FLOW.md](docs/PROJECT_API_AND_FLOW.md): API usage, technologies, and end-to-end application flow

## Environment Files

Root compose env:

```env
FRONTEND_PORT=80
BACKEND_PORT=5000
MONGO_PORT=27017
MONGO_ROOT_USERNAME=bugtracker
MONGO_ROOT_PASSWORD=bugtracker
MONGO_APP_DATABASE=bugtracker
JWT_SECRET=change-me
ALLOW_ADMIN_CREDENTIALS=false
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-smtp-password
EMAIL_SECURE=true
EMAIL_FROM=Pirnav Support <your-email@example.com>
APP_URL=http://localhost
VITE_API_BASE_URL=/api
```

Backend env example:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/bugtracker
JWT_SECRET=change-me
```

Frontend env example:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Docker Usage

1. Copy the compose env file:

```bash
cp .env.example .env
```

2. Build and start everything:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: `http://localhost`
- Backend API: `http://localhost:5000`
- Test email route: `http://localhost:5000/test-email`
- Optional override recipient: `http://localhost:5000/test-email?to=someone@example.com`
- MongoDB: `mongodb://localhost:27017`

## Frontend Setup (Ubuntu/macOS)

Use the repo-pinned Node version before installing frontend dependencies. The repo now includes both `.nvmrc` and `.node-version`, and the frontend install preflight enforces the same Node/npm range as `frontend/package.json`.

```bash
nvm install 20.19.0
nvm use 20.19.0
node -v
npm -v

cd frontend
npm run preflight
npm ci
npm run dev
```

Expected toolchain:

- Node `20.19.0` or newer on the `20.x` line, or `22.12.0+`
- npm `10+`

For Dockerized runs from a fresh clone:

```bash
cp .env.example .env
docker compose up --build
```

The frontend Docker build intentionally uses `npm ci`, so `frontend/package-lock.json` must stay committed and in sync with `frontend/package.json`.

## Mongo Restore Behavior

- The Mongo image restores the backup from `deploy/mongo/backup/bugtracker/` only on the first boot of an empty Mongo volume.
- If you want to re-run the restore from scratch:

```bash
docker compose down -v
docker compose up --build
```

## Refresh The Mongo Backup

The repo now includes a reusable export script that snapshots the current local database into `deploy/mongo/backup/bugtracker/`.

```bash
cd backend
npm run backup:export
```

This exports:

- collection data as Mongo Extended JSON
- collection indexes in `manifest.json`

## Local Non-Docker Development

Backend:

```bash
cd backend
npm ci
npm run dev
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

## Frontend Dependency Workflow

- Use `npm ci` for fresh clones, local verification, and Docker builds.
- Only use `npm install` or `npm uninstall` inside `frontend/` when you are intentionally changing dependencies.
- Always commit both `frontend/package.json` and `frontend/package-lock.json` after dependency changes.
- Before pushing dependency updates, verify them with `cd frontend && npm ci && npm run build`.

## Deployment Notes

- The frontend container serves static files through Nginx and proxies `/api` to the backend container.
- The frontend Nginx config also proxies `/test-email` to the backend for quick mail verification in Dockerized runs.
- The backend container connects to Mongo using compose network DNS (`mongo`).
- Mail notifications in Docker require `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SECURE`, `EMAIL_FROM`, and `APP_URL` in the root compose `.env`.
- The backend still seeds the default admin user on startup.
- Workspace isolation remains intact because the existing app logic and Mongo data are unchanged.

## Default Login

```text
email: admin@example.com
password: admin123
```

## Useful Commands

```bash
docker compose up --build
docker compose down
docker compose down -v

cd backend && npm run backup:export
cd backend && npm run start
cd frontend && npm run build
```
