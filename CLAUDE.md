# PadelIQ — Project Context & Domain Quirks

## UI / Frontend rules
- **Minimum font size is 12px** — never go below this, including uppercase labels, meta text, and section headers.

## What we're building
PadelIQ: a padel player rating tool that corrects World Padel Rating (WPR) for:
1. **Partner quality** — doubles match; your rating shouldn't drop when your partner drags you down
2. **Sectional inflation** — some regions have inflated local ratings
3. **Racket sport prior** — tennis/squash background predicts likely skill ceiling for new padel players

V1 is CLI, personal use + small SF Bay Area friend group. Web app eventually.

---

## WPR / Red Padel API

- GraphQL endpoint: `https://api.redpadel.com/graphql`
- Auth: JWT Bearer token via `mutation Login`
- Key operations: `Search`, `GetUser`, `GetMatches`
- `ratingBefore` / `ratingAfter` are stored per player per match — no need to reconstruct historical ratings
- `verified: true` filter removes test/draft matches (organizer entries that never played)
- Mixed-gender matches: keep them in (don't filter out)

---

## WPR Rating Scale

**Important:** WPR uses **separate rating pools for men and women** — numbers are not comparable across genders.

### Anchors from WPR site (world rankings → rating)

| Rank | Women | Men |
|------|-------|-----|
| Top 20  | 16.2 | 20.6 |
| Top 50  | 15.4 | 20.0 |
| Top 100 | 14.6 | 19.2 |
| Top 150 | 14.0 | 18.4 |
| Top 200 | 13.4 | 18.0 |
| Top 250 | 13.0 | 17.6 |
| Top 300 | 12.6 | 17.2 |
| Top 500 | 12.0 | 16.8 |

**Key calibration point:** Below 12.0 (women) or 16.8 (men) = outside world top 500. Most US competitive players live in this range.

### US division table (authoritative — matches USPA tournament divisions)
| Division | WPR |
|----------|-----|
| Women Developmental | 4.0 or less |
| Women Intermediate | 4.1 – 6.5 |
| Women High-Intermediate | 6.6 – 8.9 |
| Women Advanced | 9.0+ |
| Men Beginner | 6.5 or less |
| Men Intermediate | 6.6 – 8.9 |
| Men High-Intermediate | 9.0 – 11.9 |
| Men Advanced | 12.0+ |

Note: Women's table was updated to add High-Intermediate tier (6.6–8.9) and rename the bottom tier to Developmental.

### Women — approximate US tiers (secondary reference)
| Rating | Tier |
|--------|------|
| 1–4    | Beginner / social |
| 4–7    | Recreational competitive |
| 7–10   | Advanced club / local tournament level |
| 10–12  | US national competitive (USPA 500/1000/2000 top players) |
| 12–14  | World top 300–500 |
| 14–16  | World top 100–300 |
| 16+    | World top 20–100 (pro circuit) |

### Men — approximate US tiers (secondary reference)
| Rating | Tier |
|--------|------|
| 1–5    | Beginner / social |
| 5–9    | Recreational competitive |
| 9–14   | Advanced club / local tournament level |
| 14–17  | US national competitive |
| 17–19  | World top 300–500 |
| 19–21  | World top 100–300 |
| 21+    | World top 20–100 (pro circuit) |

**When prompting Claude about WPR priors:** always provide this scale as context. Sonnet has thin training data on WPR and will hallucinate estimates without an anchor.

---

## Tournament / Match Structure Quirks

### drawType values
- `MAIN` — normal knockout bracket match
- `ROUND_ROBIN` — **treat identically to MAIN** for all analysis and partner adjustment
  - Why: Women's padel tournaments in the US often don't reach the 8-team minimum for a full knockout bracket. Round robin format fills the gap. These are real competitive matches with full rating impact — not a lesser format.
- `CONSOLATION` — back draw after a main draw loss. **Exclude from partner analysis.** A win here doesn't mean beating those opponents fairly — both teams were already eliminated.
- `QUALIFYING` — pre-tournament qualifier. Include but treat with slightly lower weight than main.

### For analysis purposes
- **Include:** `MAIN` + `ROUND_ROBIN`
- **Exclude:** `CONSOLATION`
- **Caution:** `QUALIFYING` (context-dependent)

---

## Racket Sport Prior

### How racket sports transfer to padel

Padel combines two distinct skill sets: hitting over the net (like tennis) and defending off the back/side glass (like squash). Because of this:

**Tennis background contributes:**
- Groundstrokes, net volleys, overhead smashes
- Power, footwork, rally consistency
- Serve return instincts

**Squash background contributes:**
- Reading angles off glass walls
- Movement in tight/enclosed spaces
- Soft touch, drop shots, deceptive play
- Comfort under pressure in corners

**Tennis + squash together can be more predictive than either alone.** Someone with strong backgrounds in both may have a higher padel ceiling than a pure tennis player, because they already have both halves of the padel skill set. Stack both signals when both are present — don't discard squash just because tennis is also there.

Pickleball has moderate overlap (net game, dinking) but limited wall game and typically slower development path.

### College tennis — divisions do NOT map cleanly to skill

**Do not assume D1 > D2 > D3.** The NCAA division system reflects academic/athletic priorities and school size, not talent ceiling:
- A player at a top D3 program (e.g. Williams, Amherst, Middlebury, Emory, Pomona-Claremont) may be equivalent to a mid-major D1 player
- An unknown D1 program may be far weaker than a top D3 school
- D3 athletes often chose the school for academics + athletics combined; some D1 athletes are there primarily on athletic scholarship

**What to look for instead of just the division:**
- Individual ITA ranking (national or regional) — this is the real signal
- All-American status (any division)
- Team ranking within their division (top 25 D3 > bottom 50 D1)
- Conference strength (NESCAC D3 is highly competitive; many D1 conferences are not)

If web search returns only "played college tennis at [School]" with no ranking detail, treat it as a moderate signal at best and flag low confidence.

### Estimating the prior

When assessing a player's racket background, evaluate:
1. **What sport(s) they played and at what level** — use the college context above, look for ITA rankings, NTRP, pro history
2. **How well each sport transfers to padel** — tennis and squash are both high transfer; use them together when present
3. **Age** — physical ceiling declines meaningfully after ~35. A former WTA pro at 50 has a much lower ceiling than at 25. Adjust estimates down for older players.
4. **Data availability** — if the player already has 9+ padel matches, the prior weight drops to ~20%. Let actual padel data dominate.

**Rough WPR ceiling estimates (women's scale) by background and age:**

| Background | Age <35 | Age 35–45 | Age 45+ |
|------------|---------|-----------|---------|
| Pro WTA/ITF (ranked) | 12–15 | 10–13 | 8–11 |
| Top college tennis (nationally ranked) | 10–13 | 8–11 | 6–9 |
| Mid-level college tennis | 8–11 | 6–9 | — |
| NTRP 5.0 (verified) | 9–12 | 7–10 | — |
| Competitive college squash | 9–11 | 7–9 | — |
| NTRP 4.5 (verified) | 7–10 | 5–8 | — |
| NTRP 4.0 (verified) | 5–7 | — | — |
| Recreational squash | 4–6 | — | — |

Tennis + squash combination: consider the upper end of the relevant ranges or slightly above, since both padel skill sets are covered.

Men's ceilings run ~3–5 points higher (calibrate against the men's tier table above).

**Prior weight by padel match count:**
- 0–3 main/RR matches: prior is primary (~70% weight)
- 4–8 matches: prior is secondary (~40% weight)
- 9+ matches: prior is informational only (~20% weight); padel data dominates

Always cross-reference the prior estimate against actual opponent ratingBefore values. Never project a ceiling higher than what the player's real match results support.

---

## Match Analysis Factors (feeding into compute_rating())

### What counts as a competitive match
- **Include:** `MAIN` + `ROUND_ROBIN`
- **Exclude:** `CONSOLATION` — back draw, both teams already eliminated, not meaningful
- **Walkovers/retirements:** keep in match count and partner comparisons; exclude from score margins

### Three partner comparisons (all required)
For each MAIN/RR match, compute:
1. **Partner vs. opponents:** `partner_ratingBefore` vs. `avg_opponent_ratingBefore` — the core correction signal. If partner was weaker, the loss should count less against the rated player.
2. **Partner vs. self:** rated player's `ratingBefore` vs. `partner_ratingBefore` — were you the stronger or weaker player on your own team? Consistently being the stronger player means you're carrying; wins deserve more credit, losses are less damning.
3. **Me vs. opponents:** rated player's `ratingBefore` vs. `avg_opponent_ratingBefore` — are you consistently playing up (punching above your weight) or down? Playing up and losing is expected; playing down and losing is a signal.

Core formula (partner vs. opponents — outcome-sensitive):
```
partner_delta = partner_ratingBefore - avg_opponent_ratingBefore
// positive = partner stronger than opponents; negative = partner weaker

if WIN:  adjusted_weight = clamp(1.0 - (partner_delta × 0.05), 0.5, 1.5)
if LOSS: adjusted_weight = clamp(1.0 + (partner_delta × 0.05), 0.5, 1.5)
```

| Partner vs opponents | Outcome | Weight | Meaning |
|---------------------|---------|--------|---------|
| Weaker | Win  | > 1.0 | You carried — counts more |
| Weaker | Loss | < 1.0 | Not your fault — counts less |
| Stronger | Win  | < 1.0 | You were carried — counts less |
| Stronger | Loss | > 1.0 | Had help, still lost — counts more |

The direction of the weight adjustment flips based on outcome. Previous formula (same weight regardless of win/loss) was incorrect for the weak-partner-win and strong-partner-loss cases.

### Score margins
- Have set scores for each match
- A 6-0, 6-0 loss tells you something very different from 6-4, 7-5
- Competitive loss (every set within 3 games) → less evidence of a true skill gap
- Bagel loss (any set 6-0 or 6-1) → stronger evidence the opponent was genuinely better
- Used to weight match outcomes in compute_rating() — close matches count less harshly
- Exclude walkovers from this analysis

### Recency weighting
- Recent matches matter more than old ones
- Player trajectory matters: someone at 8.5 trending up from 6.0 is different from someone at 8.5 declining from 11.0
- Formula (for compute_rating()): exponential decay on match date, or simple bracket (last 3 months = 1.0x, 3–6 months = 0.8x, 6–12 months = 0.6x, >1 year = 0.4x)

### Trajectory
- Compute from ratingBefore values over time (earliest → latest)
- Useful signal alongside the prior: upward-trending new padel player with tennis background → prior likely not yet absorbed, may be under-rated
- Declining trajectory → may be at or past ceiling

### Partner consistency
- If a player always plays with the same partner, their WPR is partly a team rating — lower confidence in individual skill
- Many unique partners with consistent performance = stronger individual signal
- Track: unique partner count, record with most frequent partner vs. others

---

## Sources

| Source | What it has | How to access |
|--------|-------------|---------------|
| WPR / Red Padel | Competition ratings, verified match history, partner/opponent context | GraphQL API (authenticated) |
| TennisRecord.com | NTRP ratings (verified USTA league: 4.0, 4.5, 5.0) | `web_search` with `site:tennisrecord.com` |
| ITA / college rosters | College tennis history, ITA ranking | `web_search` |
| TennisRecruiting.net | Junior/high school tennis profiles | `web_search` |
| ITF / WTA / ATP | Pro tour history | `web_search` |
| Squash / pickleball | Background signals | `web_search` |

UTR was considered and dropped: ~15–20% coverage in the padel population, less reliable than NTRP for USTA league context.

---

## Architecture Decisions

- **No scraping:** WPR has a clean GraphQL API — use it directly
- **Single agent loop:** gather + synthesis are one agent. Claude gathers data, reasons in context, and calls `output_rating` when ready. No separate synthesis step.
- **compute_rating() dropped:** the formula produced near-zero adjustments. Claude reasons about magnitude contextually from the match data.
- **Browser agent dropped:** unnecessary given the API
- **prepareBrief() injected into get_matches response:** Claude sees both raw match rows and pre-computed stats in one tool result
- **web_search (Anthropic built-in):** `{ type: "web_search_20250305", name: "web_search", max_uses: 14 }`. Handled server-side. Agent uses confirmed WPR name (not original user query) for searches; follows maiden names / alternate names if background comes up empty.

## File structure

```
src/
  types.ts        — shared types (RatingResult, MatchBrief, Confidence, etc.) + constants
  wpr.ts          — WPR GraphQL client (authenticateWPR, searchPlayers, getPlayer, getMatches)
  agent.ts        — tool definitions, runAgent loop, prepareBrief, formatBrief
  index.ts        — render + main entry point
  prompts/
    agent.ts      — agentPrompt (combined gather + reasoning + output instructions)
```
