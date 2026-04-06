# Project API And Flow Guide

This document explains how the bug tracking project is structured, which APIs it exposes, which technologies it uses, and how data flows through the system.

## 1. Project Purpose

This project is a Jira-like bug tracking and project management app. It supports:

- user registration and login
- workspace-aware access control
- project and team management
- issue creation, assignment, updates, and deletion
- comments on issues
- reporting and analytics
- email notifications for created issues

## 2. Technology Stack

### Frontend

- React 18
- Vite
- React Router
- TanStack React Query
- Axios
- Tailwind CSS
- Radix UI primitives
- Lucide icons

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- Multer for CSV/file import
- Nodemailer for email notifications

### Deployment

- Docker Compose
- Nginx for frontend static hosting and API proxying
- MongoDB container with seeded backup restore support

## 3. High-Level Architecture

The app has three main layers:

1. Frontend React app
2. Express API backend
3. MongoDB database

Request flow:

1. The frontend calls the API through `frontend/src/lib/api.js`.
2. Axios attaches the JWT token automatically when a session exists.
3. Express routes receive the request.
4. Auth middleware validates the token for protected routes.
5. Controllers process business logic and talk to MongoDB through Mongoose models.
6. JSON responses return to the frontend.
7. React Query updates UI state and cache.

## 4. Frontend API Usage

The main API client is in `frontend/src/lib/api.js`.

Important behavior:

- Base URL comes from `VITE_API_BASE_URL`
- Default fallback is `http://localhost:5000/api`
- JWT token is read from the stored session
- `Authorization: Bearer <token>` is added automatically
- `FormData` requests remove JSON content-type headers automatically
- list filters remove empty values before requests are sent

Main frontend API helpers:

- auth: `loginRequest`, `registerRequest`, `fetchAdminCredentials`
- users: `fetchUsers`, `fetchWorkspaceUsers`, `fetchManagedUsers`, `inviteUser`, `bulkInviteUsers`, `importUsers`
- projects: `fetchProjects`, `createProject`, `attachProjectTeam`, `detachProjectTeam`, `updateProjectStatus`
- teams: `fetchTeams`, `fetchTeam`, `createTeam`, `addTeamMember`, `removeTeamMember`
- issues: `fetchIssues`, `fetchMyIssues`, `createIssue`, `updateIssue`, `deleteIssue`
- comments: `fetchComments`, `createComment`
- reports: `fetchReports`, `fetchProjectReports`, `fetchUserReports`, `fetchTeamReports`

## 5. API Conventions

Base backend URL:

- local backend: `http://localhost:5000`
- frontend API base: `/api` or `http://localhost:5000/api`

General conventions:

- public routes are limited to auth and root health/test routes
- most routes require authentication
- some user-management routes require admin-only access
- JSON is the default request/response format
- file import uses `multipart/form-data`
- filters are usually sent as query parameters

## 6. Route Map

### Root And Utility Routes

- `GET /`
  - health message for backend
- `GET /test-email`
  - sends a test issue email using the configured mail credentials

### Auth Routes

Base: `/api/auth`

- `POST /register`
- `POST /login`
- `GET /admin-credentials`
- `GET /users`

Notes:

- `GET /users` is protected
- `GET /admin-credentials` is only allowed in development or when `ALLOW_ADMIN_CREDENTIALS=true`

### User Management Routes

Base: `/api/users`

- `GET /`
- `POST /invite`
- `POST /bulk`
- `POST /import`
- `POST /import-users`

Notes:

- all of these are protected
- these routes also pass through admin-only middleware
- CSV or uploaded files are handled with Multer in memory

### Workspace Routes

Base: `/api/workspaces`

- `GET /:workspaceId/users`

Purpose:

- fetch all users for a specific workspace scope

### Project Routes

Base: `/api/projects`

- `GET /`
- `POST /`
- `POST /:id/teams`
- `DELETE /:id/teams/:teamId`
- `PATCH /:id/status`

Purpose:

- create and list projects
- connect teams to projects
- mark project completion state

### Team Routes

Base: `/api/teams`

- `GET /`
- `POST /`
- `GET /:id`
- `POST /:id/members`
- `DELETE /:id/members/:userId`

Purpose:

- team creation
- team detail lookup
- adding and removing members

### Issue Routes

Base: `/api/issues`

- `GET /`
- `GET /my`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

Purpose:

- fetch all visible issues
- fetch issues assigned to the current user
- create and update issues
- delete issues

Important behavior:

- issue filters can include project, assignee, status, priority, and related scope fields
- assignee values are normalized between `assignee` and `assigneeId`
- issue creation/update can trigger assignee email notifications

### Comment Routes

Base: `/api/comments`

- `POST /`
- `GET /:issueId`

Purpose:

- create issue comments
- fetch comments for a specific issue

### Report Routes

Base: `/api/reports`

- `GET /`
- `GET /projects`
- `GET /users`
- `GET /team`

Purpose:

- overall issue summary metrics
- project-level reporting
- user-level reporting
- team-level reporting

## 7. Main Product Flow

### Authentication Flow

1. User registers or logs in from the frontend.
2. Backend validates credentials and returns a JWT token.
3. Frontend stores the session.
4. Every later protected request automatically includes the token.

### Workspace Flow

1. A user belongs to a workspace scope.
2. Protected queries use that workspace scope on the backend.
3. User/project/team/issue visibility is filtered inside that scope.

### Project And Team Setup Flow

1. Admin creates users or invites/imports them.
2. Teams are created and members are added.
3. Projects are created.
4. Teams are attached to projects.

### Issue Lifecycle Flow

1. User creates an issue.
2. Backend stores the issue in MongoDB.
3. If an assignee is selected, an email can be sent to that assignee.
4. Assigned users see issues in their dashboard and task views.
5. Users update status, priority, due date, assignee, and other fields.
6. Comments are added as issue discussion history.
7. Reports aggregate the same issue data for analytics.

### Reporting Flow

1. Frontend sends report filter parameters.
2. Backend computes summary and grouped report data.
3. Reports page renders overview cards plus grouped status, priority, project, user, and team insights.

## 8. Email Notification Flow

Current mail flow:

1. Backend receives or updates issue data.
2. Backend resolves recipient email addresses.
3. `backend/services/emailService.js` creates a Gmail transporter.
4. Email is sent using `EMAIL_USER` and `EMAIL_PASS`.
5. Frontend/developers can verify mail configuration with `/test-email`.

Required backend env values:

- `EMAIL_USER`
- `EMAIL_PASS`
- `APP_URL`

## 9. Important Environment Variables

### Backend

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `ALLOW_ADMIN_CREDENTIALS`
- `EMAIL_USER`
- `EMAIL_PASS`
- `APP_URL`

### Frontend

- `VITE_API_BASE_URL`

### Docker Compose Root

- `FRONTEND_PORT`
- `BACKEND_PORT`
- `MONGO_PORT`
- `MONGO_ROOT_USERNAME`
- `MONGO_ROOT_PASSWORD`
- `MONGO_APP_DATABASE`
- `JWT_SECRET`
- `ALLOW_ADMIN_CREDENTIALS`
- `EMAIL_USER`
- `EMAIL_PASS`
- `APP_URL`
- `VITE_API_BASE_URL`

## 10. Docker Flow

When Docker Compose is used:

1. Mongo starts first.
2. Backend starts and connects to Mongo using the compose DNS host `mongo`.
3. Frontend builds static assets.
4. Nginx serves the frontend and proxies API traffic to the backend.
5. `/api/*` and `/test-email` requests are forwarded to the backend service.

## 11. Quick API Examples

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

### Create Issue

```http
POST /api/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Bug in reports page",
  "description": "Priority rows are not aligned",
  "priority": "High",
  "status": "TO_DO",
  "assigneeId": "<user-id>",
  "projectId": "<project-id>"
}
```

### Fetch Reports

```http
GET /api/reports?projectId=<project-id>&priority=High
Authorization: Bearer <token>
```

## 12. Suggested Reading Order In The Codebase

If someone is new to the project, this is a good path:

1. `README.md`
2. `PROJECT_API_AND_FLOW.md`
3. `backend/server.js`
4. `frontend/src/lib/api.js`
5. `backend/routes/*`
6. `backend/controllers/*`
7. `frontend/src/pages/*`

## 13. Summary

This project follows a clean full-stack pattern:

- React frontend for UI and stateful data fetching
- Express backend for business logic
- MongoDB for persistence
- JWT for protected APIs
- workspace-aware data separation
- reports and dashboards built on top of issue data
- optional email notifications for assignee workflows
