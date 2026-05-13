# SpecPulse Demo Backend

Minimal Fastify demo service used to showcase [SpecPulse](https://github.com/volodymyr-vysotskyi) on GitHub: pull requests get a Check Run that audits the diff against the spec’s Acceptance Criteria, and merges to `main` record an implementation ADR.

Wired to `SPEC-membership-access` via `.github/specpulse.yml`.

## Scripts

```bash
npm install
npm run build
npm test
```
