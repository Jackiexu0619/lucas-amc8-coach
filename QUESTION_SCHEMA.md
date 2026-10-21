# Question Schema — v0.6.3

## Legacy generated question
`id / domain / skill / core_method / difficulty / prompt / choices / answer / hints / trap_tags / source`

Legacy IDs such as `q017` are retained only so older attempts can still be interpreted.

## Authentic AMC8 runtime question
The browser converts each structured historical problem into:

- `id`: `real_<year>_<problem number>`
- `year`
- `problem_number`
- `problem_html`: original structured HTML from the upstream dataset
- `choices[5]`
- `answer`: A–E
- `domain`: heuristic/coarse classification
- `skill`: broad official AMC8 domain + band
- `core_method`: broad official domain + band
- `difficulty`: derived from actual AMC8 position
- `official: true`
- `active: true`
- `variant_group`
- `amc_band`
- `source`

Difficulty mapping:
- 1 = Q1–8
- 2 = Q9–16
- 3 = Q17–21
- 4 = Q22–25

The app must not invent missing official problem text. If the upstream authentic bank cannot be loaded, automatic daily/weekend question generation is blocked rather than silently falling back to the retired easy bank.
