# Campus Placement & Internship Portal

A role-based recruitment platform modeling an institutional campus placement portal. The platform implements three distinct, permission-bound interfaces: **Student Applicants**, **Company Recruiters**, and **Placement Cell Administrators**.

Server-rendered multi-page application (Node.js / Express / EJS) backed by SQLite.

## Features

- **Three distinct role workflows**
  - **Student Applicant** — browses approved job openings, manages a profile (branch, CGPA, graduation year, resume link), submits applications, and tracks progress.
  - **Company Recruiter** — creates a company profile, publishes job postings with eligibility criteria (minimum CGPA, allowed branches), reviews candidate profiles, and updates hiring status.
  - **Placement Cell Admin** — dedicated portal where newly registered companies and job postings must be approved or rejected before becoming visible to students.
- **Server-side eligibility gating** — the backend evaluates applicant profiles against posting criteria (CGPA threshold + branch allow-list). Ineligible students are blocked from submitting, with a clear explanatory notice.
- **Application tracking pipeline** — multi-page candidate view for real-time status tracking (`applied → under_review → shortlisted/rejected → hired`). Recruiters can transition a single applicant or batch-select many at once.
- **Administrative action logs** — every approval/rejection is recorded with a timestamp and the reviewing admin's ID.

## Tech stack

- Node.js + Express (multi-page server-rendered routes, not an SPA)
- EJS templates
- SQLite via `better-sqlite3` (file-based, zero external setup)
- `express-session` with a SQLite-backed session store
- `bcryptjs` for password hashing

## Local setup

**Requirements:** Node.js 18+ (tested on Node 22).

```bash
# 1. Install dependencies
npm install

# 2. Populate the database with schema + mock data
npm run seed

# 3. Start the server
npm start
# (or: npm run dev   — restarts automatically on file changes)
```

The app runs at **http://localhost:3000**.

The SQLite database file is created automatically at `data/portal.db` on first run (schema is applied via `src/db/schema.sql`). `npm run seed` wipes and re-populates every table, so it's safe to re-run at any time to reset to a known state.

## Mock login credentials

After running `npm run seed`, log in at `/login` with any of the following:

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@portal.edu` | `Admin@123` | Placement Cell administrator |
| Recruiter | `recruiter1@techcorp.com` | `Recruiter@123` | TechCorp Solutions — **approved** company |
| Recruiter | `recruiter2@newstartup.io` | `Recruiter@123` | NewStartup Inc — **pending** company (demonstrates the admin approval queue) |
| Student | `student1@college.edu` | `Student@123` | CSE, CGPA 8.8 — eligible for most postings |
| Student | `student2@college.edu` | `Student@123` | ECE, CGPA 7.2 |
| Student | `student3@college.edu` | `Student@123` | IT, CGPA 6.0 — below most eligibility bars, useful for testing the ineligibility notice |

You can also register new Student or Recruiter accounts directly from `/register`. New recruiter-created companies always start in `pending` status and require admin approval.

## Sample database population

```bash
npm run seed
```

This runs [`src/db/seed.js`](src/db/seed.js), which:
- clears every table (idempotent — safe to re-run),
- creates the admin, recruiter, and student accounts listed above,
- creates one approved company (TechCorp Solutions) and one pending company (NewStartup Inc),
- creates four job postings in a mix of `approved` / `pending` states, with varying CGPA and branch requirements,
- creates a few sample applications in different pipeline states,
- seeds a few admin audit log entries.

To inspect the database directly (no `sqlite3` CLI required):

```bash
node -e "const db = require('./src/db'); console.log(db.prepare('SELECT * FROM jobs').all());"
```

## Project structure

```
server.js                  App entry point
src/
  db/
    schema.sql              Table definitions
    index.js                Opens/initializes the SQLite connection
    seed.js                 Mock data population script
  middleware/
    auth.js                 Session-based auth + role guards
  routes/
    auth.js                 Login / register / logout
    student.js               Student workflow routes
    recruiter.js             Recruiter workflow routes
    admin.js                  Admin workflow routes
  utils/
    eligibility.js           Server-side eligibility gate (CGPA + branch check)
views/                      EJS templates, organized per role
public/css/style.css        Styling
data/                       SQLite database + session store (gitignored)
```

## Permission boundaries

- All `/student/*`, `/recruiter/*`, and `/admin/*` routes are guarded server-side by session role checks (`src/middleware/auth.js`) — not just hidden in the UI.
- Students only ever see jobs where **both** the job and its parent company are `approved`.
- Recruiters can only view/manage companies and jobs they own (ownership is checked against `recruiter_user_id` on every request, not inferred from the URL).
- Eligibility (CGPA + branch) is re-validated server-side on every application submission, even if the UI already hid an "Apply" button.
