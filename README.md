# MATACS-TH-2026-02

**Full name:** Abdul Rehman
**Reference:** MATACS-TH-2026-02
**Time spent:** 2 hours

**AI tools:** Coding agent (Grok 4.7) drafted this repository from the assessment brief. That includes the process design, [WRITEUP.md](WRITEUP.md), [PROMPTS.md](PROMPTS.md), the diagram, [ranking.json](ranking.json), and the prototype. The ranking is the output of `node prototype/score.js`. No model was called to score the samples. The proposal text was not sent to a scoring API.

## Files

- [README.md](README.md) — name, reference, time, and AI use
- [WRITEUP.md](WRITEUP.md) — answers to the five design questions
- [PROMPTS.md](PROMPTS.md) — extraction prompt sent to the model
- [ranking.json](ranking.json) — ranking of proposals A–E
- [diagram/process-flow.png](diagram/process-flow.png) — flow from upload to ranked list
- [prototype/score.js](prototype/score.js) — rules that turn confirmed facts into the ranking
- [prototype/criteria.json](prototype/criteria.json) — category criteria and weights
- [prototype/extractions.json](prototype/extractions.json) — sample proposal text and confirmed facts

## Run the prototype

Requires Node.js. No packages to install.

```bash
node prototype/score.js
```

The script rewrites `ranking.json`.
