# Plotwise: rules for agents

Bangkok plot → allowed envelope → at least two concept designs in 3D, each with a pass/fail checklist. Brief: BRIEF.md. Plan: docs/04-tech-plan.md (written for Bangalore; the engine carries over, the rules are rebuilt for Bangkok). Decisions: DECISIONS.md. Research: research/. Stack: Next.js 16 App Router + React 19 + TypeScript on bun; MapLibre (plot drawing), three.js via react-three-fiber (3D), clipper2-ts (geometry). Read node_modules/next/dist/docs/ before using a Next API you are unsure of (see AGENTS.md).

## Hard rules
- No code comments. KISS, YAGNI, DRY.
- Every rule number is compiled into src/rules/packs/*.json from pointers/*.json by tools/compile-pack.ts. Never type a rule value into a pack or a pointer file. If a source line is unreadable, raise a question and stop.
- Every assumption lives in src/solve/assumptions.ts with a source string.
- Internal units: metres, sqm, baht.
- AI never computes an area, a limit or a cost. AI reads rules, reads briefs, explains trade-offs.
- Free only. No paid APIs. Never call the Claude API from code, scripts or evals.
- Tests first for anything numeric (vitest + fast-check). Show the real test output when done.
- Commits: author "Kunal Roy Choudhury <71250874+kunalgoesbyken@users.noreply.github.com>", no co-author lines.
- Ask before deleting files, force-pushing or changing a rule pack's verified values.
- Never commit transcripts (*-session.md) or secrets.

## Commands
- install: bun install
- dev: bun run dev
- test: bunx vitest run
- compile rules: bun tools/compile-pack.ts <packId>
- check rules: bun tools/check-pack.ts <packId>
- build: bun run build
- deploy: vercel --prod
