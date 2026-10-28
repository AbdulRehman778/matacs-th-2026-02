# How the triage tool works

The reviewer picks a category. The tool loads that category's saved criteria and never reads a hard-coded solar checklist. For this project the record has two pass/fail checks and five weights that sum to 100. The path from upload to a ranked list is in `diagram/process-flow.png`. The sample result is in `ranking.json`. `prototype/score.js` is the rules step: it reads saved criteria and confirmed facts, and it does not call a model.

## 1. AI vs rules

Code does the work that has to stay exact. It extracts text from the PDF, loads the criteria version, and scans the text for lines that tell a machine how to rank the file. It keeps a value only when the quote really appears in the text. It then applies pass/fail, the weight formulas, the sort, and the reason line.

AI does one job: turn unstructured proposal text into JSON. Layouts differ, so a fixed parser would miss ordinary wording. The call uses temperature 0 and must return the schema, with a quote copied from the proposal, or null when the proposal is silent. The proposal is data, not instructions. The model is not asked to score, rank, or pass a mandatory check. Those stay in code, so a note inside a PDF cannot award points.

## 2. Consistency and explainability

The same confirmed facts always produce the same scores, because the formulas do not use the model. A second extraction can still word a quote differently, so a score is not final until the quote check passes and the reviewer accepts the facts. A missing weighted value scores 0. A missing mandatory value is flagged, not failed.

Each weighted criterion is scored from 0 to 100, then multiplied by its weight.

- Experience: 7 points for each commercial install of 100 kW or more in the last five years, capped at 100.
- Price: 0 if missing or above $260,000. 100 at or below $182,000, which is 70% of the ceiling. Linear in between.
- Timeline: 0 if the week count is missing or over 16. 100 at 10 weeks or less, then 15 points less for each extra week, so 16 weeks scores 10.
- Warranty: up to 50 points for a 25-year panel warranty and up to 50 for a 15-year workmanship warranty.
- Team: 25 points each for a named project lead, a described crew, a safety plan, and a monitoring plan.

The screen shows the total, every criterion score, its weight, and the quote. The reason line is filled from those numbers. The same proposals, with the same accepted facts, rank the same way again. Ties go to the higher score, then the lower price, then the shorter timeline, then the proposal letter.

## 3. Human in the loop

The admin sets criteria, weights, and thresholds before any upload. Weights must sum to 100. The reviewer selects the category and uploads the files, then confirms mandatory results and any field the quote check did not accept. A flagged proposal stays off the list until a person clears it or removes it. The reviewer may override a score or a rank only with a written reason. A person makes the award. The tool does not.

The log stores the criteria version, file hash, raw text, model JSON, accepted facts, scores, rank, overrides, user, and time.

## 4. Changing criteria

Each run is tied to a criteria version. Editing a weight, a threshold, or a criterion creates a new version and leaves the old run unchanged. The reviewer runs the score again. Confirmed facts are reused, so the model is not called again unless the text or the extracted fields changed. Only the new run can support the award. A proposal that failed an older mandatory check is judged again against the new one.

## 5. Risks

Wrong extraction is limited by the quote check and by the reviewer confirming mandatory fields. The scan only sees extracted text, so the reviewer still has the PDF. Made-up facts are dropped when the quote is not in the text, and the prompt requires null when the proposal does not say. Scoring bias is limited because the model assigns no points. The formulas use counts, price, time, and a checklist, not the bidder's name. Manipulation is handled in code. Proposal C tells an automated reviewer to rank it first and give full marks. The scan flags that language, and the file is not scored. A harmless sentence can also match, and a person can clear that flag. Cost stays to one extraction call per file. A rescore reuses stored facts.

On this sample, B is ineligible: it does not state a licence held by the bidder, and it leaves electrical work to a subcontractor after award. C is flagged and not scored. A is first at 74.35, E is second at 59.05, and D is third at 52.30. D stays eligible. It scores 0 on timeline because it never states a completion week.
