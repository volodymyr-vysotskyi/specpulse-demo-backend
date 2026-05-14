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
├── src/
│   ├── app.ts
│   ├── membership.ts
│   ├── password.ts
│   ├── server.ts
│   └── user-store.ts
├── tests/
│   ├── membership.test.js
│   └── users-auth.test.js
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

## Users (demo, no auth)

In-memory store; restart clears data. Passwords are hashed with scrypt for storage, but **there is no authentication or authorization** on these routes (open CRUD for local demos).

- `POST /auth/register` — `{ email, password, name }` → `{ user }`. First account is **superadmin**; later registrations are **user**.
- **Roles** on users: `user`, `admin`, `superadmin` (set via `POST /users` or `PATCH /users/:id`).
- `GET /users` — list all users.
- `GET /users/:id` — get one user.
- `POST /users` — `{ email, password, name, role? }`.
- `PATCH /users/:id` — any of `email`, `name`, `password`, `role`.
- `DELETE /users/:id` — remove user.

## Env

Dev/Prod
