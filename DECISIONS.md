# Decisions

| # | Decision | Why | Status |
|---|---|---|---|
| D0 | Keep the prepared plot → envelope → designs engine; rebuild the rule pack from Thai sources; add a real-site 3D context task. | The brief is plot feasibility (main plan), but for Bangkok, not Bangalore. Indian rule sources don't apply. | Decided 2026-11-19 |
| D1 | Which Bangkok zone | Pending research/bkk-rules.md | Open |
| D2 | Next.js + React + TypeScript on bun, no Python backend | Kunal asked for bun and React/Next or Python. The brief needs live updates with no reload, so geometry must run in the browser; Python would add a round-trip and a second runtime. Next route handlers cover the one server job (cached Overpass proxy). One Vercel project. | Decided 2026-11-19 |
