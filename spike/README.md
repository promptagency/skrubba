# Spike – test the engine on real texts first (Skrubba)

Before any UI is built, run maskera on texts that look like what the audience actually writes.

## Owner to-do

Put 3–5 texts in `spike/texts/` as `.txt`. Fictional but realistic. Suggested mix:

- `hr-arende.txt` – a HR note or email about an employee (sick leave, conflict, salary)
- `kundbrief.txt` – an agency brief with client name, unreleased product, budget figures
- `protokoll.txt` – minutes from a meeting, with names and roles
- `chatt.txt` – a lowercase, informal chat or support log
- `blandat.txt` – personnummer, org.nr, addresses and org names that are also common words (Ikea, Volvo, Stena)

For each text, write the expected entities in a sibling `*.expected.txt`, one per line, so misses can be counted.

## Claude Code to-do

`scripts/spike.ts` runs every text through `redactWithNer` (dtype q4 and q8) and `redact` (rules only), prints masked output, lists expected values that still appear verbatim in the output (= leaks) and values masked that are not in the expected list (= over-masking), and timings. Writes `spike/RESULTS.md`.

## Decision rule

- Leaks on NAMN or PERSONNUMMER on the target register above a handful per text → try q8, then KBLab lowermix. Record.
- Over-masking is tolerable; the UI lets the user keep values.
- Rules-only mode must be flawless on structured identifiers. Any rule miss is a bug to report upstream.
