# Plotwise: rules for agents

Bangkok plot → allowed envelope → at least two concept designs in 3D, each with a pass/fail checklist. Brief: BRIEF.md. Plan: docs/04-tech-plan.md (written for Bangalore; the engine carries over, the rules are rebuilt for Bangkok). Decisions: DECISIONS.md. Research: research/. Stack: Next.js 16 App Router + React 19 + TypeScript on bun; MapLibre (plot drawing), three.js via react-three-fiber (3D), clipper2-ts (geometry). Read node_modules/next/dist/docs/ before using a Next API you are unsure of (see AGENTS.md).

## Code quality
- Production-ready, self-documenting code: no comments, debug code, unused imports, dead logic or unused dependencies.
- KISS first, then DRY and YAGNI. SOLID only where it makes the code clearer. Composition over inheritance. No clever hacks, premature optimisation or patterns without a need.
- Small single-responsibility functions, early returns, low nesting, descriptive names. Extract shared logic only after a clear pattern appears.
- Feature-first folders (src/rules, src/geometry, src/site, ...), not layer-first. Modules loosely coupled through explicit typed interfaces; no hidden shared state.
- Make illegal states unrepresentable (discriminated unions, zod at the boundary). Validate and handle errors at the boundary (user input, network, files), trust types inside.
- Avoid: god files, pass-through wrappers, layering violations, changes that need edits in many places, brittle regex and hardcoded values. Ask how it breaks with many users, Thai/English text and different user types.
- Follow the existing architecture and style. Before finishing, reread the diff and simplify until nothing can be removed without losing clarity.

## Hard rules
- Every rule number is compiled into src/rules/packs/*.json from pointers/*.json by tools/compile-pack.ts. Never type a rule value into a pack or a pointer file. If a source line is unreadable, raise a question and stop.
- Every assumption lives in src/solve/assumptions.ts with a source string.
- Internal units: metres, sqm, baht.
- AI never computes an area, a limit or a cost. AI reads rules, reads briefs, explains trade-offs.
- Free only. No paid APIs. Never call the Claude API from code, scripts or evals.
- Tests first for anything numeric (bun test + fast-check, import from "bun:test"). Show the real test output when done. Browser tests are Playwright files named *.e2e.ts.
- Commits: author "Kunal Roy Choudhury <71250874+kunalgoesbyken@users.noreply.github.com>", no co-author lines.
- Ask before deleting files, force-pushing or changing a rule pack's verified values.
- Never commit transcripts (*-session.md) or secrets.

## Commands
- install: bun install
- dev: bun run dev
- test: bun test
- e2e (local prod build): bun run build && bun run e2e   (live: E2E_URL=https://plotwise-ashy.vercel.app bun run e2e; real GPU: E2E_GPU=1)
- compile rules: bun tools/compile-pack.ts <packId>
- check rules: bun tools/check-pack.ts <packId>
- typecheck: bun run typecheck   (next typegen, then tsc --noEmit; no build needed)
- build: bun run build
- deploy: vercel --prod
