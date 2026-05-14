# SpecPulse Demo Backend

Minimal Fastify demo service used to showcase [SpecPulse](https://github.com/volodymyr-vysotskyi) on GitHub: pull requests get a Check Run that audits the diff against the spec’s Acceptance Criteria, and merges to `main` record an implementation ADR.

Wired to `SPEC-membership-access` via `.github/specpulse.yml`.

## Folder structure

```text
specpulse-demo-backend/
├── .github/
│   └── specpulse.yml
├── .cursor/
│   └── SPEC.md
├── web/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── src/
│   ├── app.ts
│   ├── membership.ts
│   ├── password.ts
│   ├── server.ts
│   ├── session-store.ts
│   └── user-store.ts
├── tests/
│   ├── membership.test.js
│   └── users-auth.test.js
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

## Web UI (role-aware)

Static app is served at **`/app/`** (e.g. `http://localhost:3001/app/`). It uses hash routes (`#/dashboard`, `#/admin`), reflects **Admin** vs **Client** from server roles (`admin` / `superadmin` vs `user`), hides admin navigation for clients, and shows a plain-language page if a client opens `#/admin`. Sign-out calls `POST /auth/logout` and clears server session.

## Users & sessions (demo)

In-memory store and sessions; restart clears data. Passwords use scrypt. **`/users` CRUD remains open** (no server-side authorization on those routes); the web app only gates admin screens.

- `POST /auth/register` — `{ email, password, name }` → `{ user }` and sets an **httpOnly session** cookie. First account is **superadmin**; later registrations are **user**.
- `POST /auth/login` / `POST /auth/logout` / `GET /auth/me` — session cookie `sp_session`.
- **Roles** on users: `user`, `admin`, `superadmin` (set via `POST /users` or `PATCH /users/:id`).
- `GET /users` — list all users.
- `GET /users/:id` — get one user.
- `POST /users` — `{ email, password, name, role? }`.
- `PATCH /users/:id` — any of `email`, `name`, `password`, `role`.
- `DELETE /users/:id` — remove user.

## Env

Dev/Prod
