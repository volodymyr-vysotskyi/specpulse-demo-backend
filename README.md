# specpulse-demo-backend

Backend demo repository for [SpecPulse](https://github.com/volodymyr-vysotskyi). Wired to `SPEC-membership-access` via `.github/specpulse.yml`.

When the SpecPulse GitHub App is installed on this repo, every pull request gets a Check Run that audits the diff against the spec's Acceptance Criteria. On merge to `main`, SpecPulse records an implementation ADR.

## Scripts

```bash
npm install
npm run build
npm test
```
