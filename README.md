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

## Users and auth (demo)

In-memory store; restart clears data. Passwords hashed with scrypt. Bearer tokens are opaque session IDs (also in memory).

- `POST /auth/register` — body: `{ email, password, name }`. First registered account is **admin**; later ones are **user**.
- `POST /auth/login` — `{ email, password }` → `{ token, user }`.
- `POST /auth/logout` — `Authorization: Bearer <token>` (204).
- `GET` / `PATCH /users/me` — authenticated user; PATCH allows `name`, `password`.
- `GET /users` — **admin**: list users.
- `GET /users/:id` — self or **admin**.
- `POST /users` — **admin**: `{ email, password, name, role? }`.
- `PATCH /users/:id` — self (`name`, `password`) or **admin** (+ `email`, `role`). Cannot demote or delete the last admin.
- `DELETE /users/:id` — **admin**.

## Env

Dev/Prod
