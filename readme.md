# Research Lab Slot Booking System

Role-based web app for managing lab resources, slot requests, attendance, marks, complaints, and document workflows across **Student**, **Faculty**, and **Admin** users.

## Project Structure

```
Lab_slot/
|- backend/                 # Express + MongoDB API
|  |- config/
|  |- controllers/
|  |- middleware/
|  |- models/
|  |- routes/
|  |- server.js
|  `- .env.example
|- frontend/
|  `- public/              # Static HTML/CSS/JS frontend
|- uploads/                # Uploaded files (served at /uploads)
`- README.md
```

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth (cookie-based)
- **Frontend:** Static HTML/CSS/JS
- **Other:** Multer (uploads), Nodemailer (email), AWS S3 SDK (optional document storage)

## Features

- Authentication (`register`, `login`, `logout`, `me`, `change-password`)
- Resource management and availability browsing
- Student slot requests and faculty/admin approval workflow
- Attendance and marks upload/publish + student view
- Complaint tracking and status management
- Admin controls for users, roles, policies, and bulk user creation
- Document request inbox (student/faculty/admin flows)
- Analytics (venue utilization and faculty workload)

## API Base

Backend mounts routes under these prefixes:

- `/api/auth`
- `/api/resources`
- `/api/slots`
- `/api/admin`
- `/api/users`
- `/api/attendance`
- `/api/marks`
- `/api/complaints`
- `/api/analytics`
- `/api/document-requests`
- Health check: `/api/health`

## Environment Variables (Backend)

Create `backend/.env` (copy from `backend/.env.example`):

```env
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:3000
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false

SERVE_FRONTEND=true

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=

AWS_REGION=
AWS_S3_BUCKET=
AWS_S3_PREFIX=request-documents
```

## Local Setup

### 1) Install backend dependencies

```bash
cd backend
npm install
```

### 2) Start backend

```bash
npm run dev
```

or

```bash
npm start
```

By default, backend runs on `http://localhost:5000` (or next free port if 5000 is occupied).

### 3) Run frontend

This project frontend is static (`frontend/public`), and you can use either approach:

- **Option A (recommended):** let backend serve frontend by setting `SERVE_FRONTEND=true`, then open `http://localhost:5000`.
- **Option B:** host `frontend/public` with any static server (e.g. Live Server / Vercel), and keep backend as API.

## Deployment Notes

- In production, backend defaults to API-only unless `SERVE_FRONTEND=true`.
- For cross-site cookie auth (frontend and backend on different domains), set:
  - `COOKIE_SAME_SITE=none`
  - `COOKIE_SECURE=true`
- `frontend/public/vercel.json` currently rewrites:
  - `/api/*` -> `https://api.library-api.me/api/*`
  - `/uploads/*` -> `https://api.library-api.me/uploads/*`

Update those URLs for your deployed backend domain if needed.

## Useful Endpoints

- `GET /api/health` - backend health check
- `POST /api/auth/login` - login
- `GET /api/auth/me` - current session user
- `GET /api/resources` - list resources
- `POST /api/slots/request` - create slot request (student)
- `GET /api/slots/faculty/pending` - pending approvals (faculty/admin)

## License

MIT (as declared in `backend/package.json`)
