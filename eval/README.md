# Rule-extraction eval

Question: does making the AI **point** at source lines beat having it **write** the values itself?

- **point**: the AI writes `pointers/bkk-y9.json` (page, line and token for each value). `tools/compile-pack.ts` copies the values from `sources/*.txt` into `src/rules/packs/bkk-y9.json`, and `tools/check-pack.ts` checks them.
- **write**: classic extraction. A fresh agent sees only `sources/*.txt` and `eval/fields.json`, and types each value with a page and a verbatim quote. Each run is saved as `eval/runs/write-<n>.json`:

  ```json
  { "fields": { "<path>": { "value": 7, "page": 35, "quote": "..." } } }
  ```

  `value: null` means the run marked the field unresolved.
- **write + check**: each write run's values are substituted into a copy of the pack, and `checkPack` runs on it.

## Inputs

| File | What |
| --- | --- |
| `fields.json` | The 133 cited numeric fields of the pack (path, source, clause, page). No values. Every method is scored on this scope. |
| `ground-truth/bkk-y9.json` | Values stated by independent published sources, each with URL, title and verbatim quote. A field where sources disagree is `{ "disputed": true, "sources": [{ ..., "value" }] }`. Fields no outside source covers are left out. The file was committed before the pack or pointers were opened. |
| `runs/*.json` | Write runs. The scorer scores every file it finds here. |

## Metrics

- **Accuracy**: exact match against the ground truth. A share field (a path ending in a name that contains "share") read above 1 is taken as a percentage and divided by 100. Lengths are in metres and areas in square metres; nothing else is rescaled. Disputed fields are counted separately, and match if they equal any of the disputed values.
- **Coverage**: fields answered vs unresolved.
- **Agreement**: point vs each write run, and every pair of write runs, on fields both answered. Run-to-run agreement is the uncertainty signal.
- **Grounding** (write runs): whether the quote appears in the cited source (compared on the Thai skeleton from `tools/quantity.ts`, so whitespace and split vowel and tone marks do not matter), whether the value appears on the cited page (numbers read with `tools/quantity.ts`), and whether it appears in the run's own quote.
- **Errors caught**: point = compile rejections + `checkPack`; write = `checkPack` after substitution.

## Rerun

```sh
bun install
bun test eval/                 # scorer tests
bun eval/score.ts              # prints the method table, writes eval/RESULTS.md
```

Code: `inputs.ts` (schemas), `metrics.ts` (accuracy, coverage, agreement, invariants), `grounding.ts` (quote and value checks), `report.ts` (RESULTS.md), `score.ts` (entry point).
