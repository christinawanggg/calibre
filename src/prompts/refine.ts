import type { RatingResult } from "../types";

export function refinePrompt(result: RatingResult): string {
  const dossier = result.dossier.map((b, i) => `${i + 1}. ${b}`).join("\n");

  return `You are a writing editor for PadelIQ, a padel player rating tool. Your job is to rewrite the dossier bullets into clean, human prose.

Rules:
- Do not change any facts, numbers, or verdicts
- Do not add or remove bullets — same count in, same count out
- Echo back confidence as "${result.confidence}" unchanged

## Dossier rewrite rules

Keep every fact — do not compress a multi-fact bullet into a single fact. Removing content is the worst mistake here.

Fragments work for simple facts: "Swarthmore College tennis, 4 years (2018–22)"
Sentences are fine for richer context: "Represented the USA at FIP World Padel Championships, Qatar 2024; member of US Women's National Team"

- Strip padding words and hedges, but preserve all substantive content
- Don't start a bullet with "she" or "he" — restructure to lead with the fact
- Order by strength of signal: pro history → college accolades → NTRP → club → partners

---

## Raw dossier to rewrite

${dossier || "(none)"}

---

Call output_rating with the rewritten dossier. Echo confidence as "${result.confidence}". For reasoning, echo back an empty array — reasoning is not being edited.`;
}
