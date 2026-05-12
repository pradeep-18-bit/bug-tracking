# Jenkins Pipeline

This repository includes a root `Jenkinsfile` for CI, SonarQube analysis, Docker Compose smoke testing, and optional deployment.

## Jenkins Agent Requirements

- Linux agent with Node.js `20.19.0+` or `22.12.0+`
- npm `10+`
- Docker Engine with Docker Compose v2
- `curl`
- `ssh` and `rsync` for remote deployment

## Jenkins Plugins And Tools

- Pipeline
- SonarQube Scanner for Jenkins
- SSH Agent, only required for `DEPLOY_TARGET=remote`
- Credentials

Configure these names, or change the job parameters:

- SonarQube server: `SonarQube`
- SonarScanner tool: `SonarScanner`
- Remote deploy SSH key credentials: `bug-tracking-deploy-ssh`

## Optional Credentials

Create a Jenkins Secret file credential containing the production compose `.env` file. Put that credential ID in `COMPOSE_ENV_FILE_CREDENTIALS_ID` when deploying.

The `.env` file should follow the root `.env.example` format and include production values for Mongo, JWT, email, app URL, and Vite settings.

For local deployment, Jenkins uses the credential as a temporary `.jenkins.env` file in the workspace. For remote deployment, Jenkins uploads it as `.env` inside `REMOTE_APP_DIR`.

## Pipeline Flow

1. Checkout
2. Verify toolchain
3. Install backend and frontend dependencies with `npm ci`
4. Run backend and frontend tests
5. Build the frontend
6. Run SonarQube analysis and quality gate
7. Build Docker Compose images
8. Start the full stack on temporary CI ports and smoke-test backend/frontend
9. Optionally deploy with Docker Compose locally or on a remote host

## Deployment Parameters

- `DEPLOY_TARGET=none`: CI only
- `DEPLOY_TARGET=local`: runs `docker compose up -d --build` on the Jenkins agent
- `DEPLOY_TARGET=remote`: syncs the repo to `REMOTE_DEPLOY_HOST:REMOTE_APP_DIR` and runs Docker Compose there

For remote deployment, the target host must already have Docker and Docker Compose installed, and the Jenkins SSH key must be allowed to log in.
