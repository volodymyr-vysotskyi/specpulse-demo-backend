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
│   ├── membership.ts
│   └── server.ts
├── tests/
│   └── membership.test.js
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

## Env

Dev/Prod/Staging
