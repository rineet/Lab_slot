# Research Lab Slot Booking System

End-to-end system for scheduling, approving, and managing research lab resources with role-based workflows, conflict-free booking, auditability, and policy enforcement.

## Tech
- Node.js, Express, MongoDB (Mongoose)
- JWT auth, bcrypt for hashing
- Frontend: HTML/CSS/Vanilla JS (served from `frontend/public`)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set env vars (optional):
   - `MONGO_URI` (default: `mongodb://127.0.0.1:27017/research_lab_booking`)
   - `JWT_SECRET` (default: `devsecret`)
   - `PORT` (default: `5000`)
3. Run server:
   ```bash
   npm start
   ```
4. Visit `http://localhost:5000` for the UI.

## API (per spec)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/resources`, `POST /api/resources` (Admin), `PUT /api/resources/:id` (Admin), `DELETE /api/resources/:id` (Admin)
- `POST /api/slots/request` (Student), `POST /api/slots/cancel/:id`, `GET /api/slots/my` (Student), `GET /api/slots/resource/:id`, `POST /api/slots/approve/:id` (Faculty/Admin), `POST /api/slots/reject/:id` (Faculty/Admin), `GET /api/slots/faculty/pending` (Faculty/Admin)
- `GET /api/admin/users` (Admin), `PUT /api/admin/users/:id/role` (Admin), `PUT /api/admin/policies` (Admin)

## Business rules implemented
- No overlapping APPROVED slots for same resource.
- Student daily/weekly hour quotas and active request cap.
- Faculty can approve/reject only their supervisees; Admin can override.
- Expired slots auto-marked EXPIRED when fetched if end time passed.
- Cancelled slots free the resource immediately.

## Manual test ideas
- Register student, faculty (set student supervisorId to faculty id), and admin.
- Create resource as admin; list as student.
- Student submits request; ensure conflicts rejected and quotas enforced.
- Faculty approves pending supervisee request; verify status/decisionReason.
- Cancel approved request and verify status.
- Admin updates policy to tighten limits and verify enforcement on new requests.


# Lab_slot