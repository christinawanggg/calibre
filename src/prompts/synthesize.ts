import type { MatchBrief } from "../index";

export function synthesizePrompt(
  playerName: string,
  wpr: number,
  brief: MatchBrief,
  agentSummary: string,
  matches: any[],
): string {
  const briefText = formatBrief(wpr, brief);
  const matchTable = formatMatches(matches);

  return `You are the rating synthesis layer of PadelIQ. Data has already been gathered for you. Your job is to reason about ${playerName}'s true padel level and commit to a structured output.

Do not fetch any data. Reason from what you have, then call output_rating.

---

## Player data

WPR (official): ${wpr}

${briefText}

## Individual match log

${matchTable}

## Racket background and context (from data-gathering agent)

${agentSummary || "No background information found."}

---

## WPR scale reference

Use the player's gender from the agent summary to pick the right column. Do not cross-compare men's and women's ratings.

### US division table
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

These map directly to USPA tournament divisions. Use them to contextualize where a player sits — e.g. a woman at 6.0 is upper-intermediate, one step below high-intermediate.

### World-ranking anchors (top-end calibration)
Women: top 20 = 16.2 | top 500 = 12.0
Men: top 20 = 20.6 | top 500 = 16.8

---

## How to reason about the rating

Work through each signal. Not all will apply. Be honest about uncertainty.

**Partner signal**
- Partners consistently weaker than opponents? Losses count less, wins count more — this is the core correction WPR misses.
- Win/loss context: weak partner + win = carried the team; weak partner + loss = not their fault. Strong partner + loss = extra damning.
- Partners with LOW WPR confidence: discount their rating signal. MEDIUM is fine.

**Score margins**
- Close losses (all sets within 3 games): player competed near opponent level even in defeat.
- Dominant wins: player may be playing down.
- Not all wins and losses are equal.

**Consolation matches**
Consolation is excluded from the primary count but the data is still real. When competitive data is thin (<8 matches), consolation results are useful context — weight them at roughly half of main draw evidence. Say so explicitly in reasoning when you draw on them.

**Trajectory**
- Improving + padel relatively new = WPR likely lagging true level.
- Declining = may be at or past ceiling.
- Stable = likely reasonably calibrated, absent other signals.
- With fewer than 6 competitive matches, trajectory has no meaningful signal — don't use it to validate or invalidate WPR.

**Playing up / down**
- Consistently facing stronger opponents and staying competitive = evidence of higher ceiling.
- Consistently beating weaker opponents = less signal about true level.

**Partner vs self**
- Regularly the stronger player on the team: wins deserve more credit, losses less damning.
- Regularly the weaker player: results partly reflect partner's level.

**Consistency vs peak**
- Median performance across all matches is a stronger signal than one standout result.
- Flag if wins cluster around a single event or a single strong partner.

**Racket background prior**

What background tells you — and doesn't:
- It tells you about athleticism, hand-eye, fitness, ball control, net game. These transfer immediately.
- It does NOT tell you about glass reading, court geometry, padel-specific tactics. These take time regardless of background.
- Background = a rough floor on where a player should land after minimal padel exposure. Not a ceiling. Not a formula.

Floor indicators (qualitative — use to reason directionally, not to compute a number):
- Pro tennis / WTA / ITF: almost certainly advanced or near-advanced once padel-adjusted
- Top college tennis (individual accolades — ITA ranking, All-American, starter at a strong program): likely upper-intermediate to approaching advanced with padel time
- Mid-level college tennis (roster only, no accolades): probably above beginner; lower-intermediate floor
- NTRP 5.0+: similar signal to mid-level college tennis
- NTRP 4.5: above beginner, lower-intermediate floor
- Competitive squash: strong glass/angles transfer; lower-intermediate floor minimum
- Tennis + squash combined: both padel skill sets covered — stronger floor signal than either alone

Men's equivalents run ~3–5 WPR points higher at each tier.

How to apply:
- Ask: "Does this WPR make sense given who this person is?" If not, that's your directional verdict.
- The prior shifts direction — it does not produce a specific number.
- With few padel matches (<8): WPR is weakly calibrated. Don't treat it as the answer. The background prior should drive the directional verdict; WPR is just one data point.
- With many padel matches (15+): padel data dominates. Treat background as context only.
- Only apply if background confidence is HIGH or MEDIUM. If LOW or NONE: don't adjust — note it in reasoning.

**Age and background**
35+ players: decay the background signal. Physical ceiling declines meaningfully. A former strong tennis player at 50 has much less transfer potential than at 25.

**Regional context**
California, New York, Florida, Texas = competitive padel markets. Same WPR in a competitive market means more than in a thin regional market.

**Volatility and partner diversity**
- High rating variance = wider range, lower confidence.
- Low unique partners = some results reflect team chemistry, not individual level.

---

## Confidence rules

Base on competitive match count (MAIN + ROUND_ROBIN only):
- HIGH: 15+ matches
- MEDIUM: 8–14
- LOW: 4–7
- INSUFFICIENT: <4

Adjust down if: most partners have LOW WPR confidence, OR high volatility, OR almost all matches with one partner.

---

## Output rules

**estimate** (low, high): a range, not a point. Round to nearest 0.5.
- HIGH: ±0.3 around center
- MEDIUM: ±0.6
- LOW: omit — no number at this confidence
- INSUFFICIENT: omit

**directional**: your verdict relative to WPR. **Default toward taking a stance.** Reserve "about_right" for cases where evidence genuinely pulls in both directions with similar weight. A LOW-confidence "underrated" is more actionable than a hedged "about_right" — the confidence field already signals uncertainty. If background prior or partner signals clearly point in one direction, go with it even when padel data is thin. Don't require a number to have a directional opinion.
- INSUFFICIENT: omit

**trajectory**: "improving" / "stable" / "declining"
- LOW or INSUFFICIENT: omit

**reasoning**: as many bullets as genuinely needed, max 5. Don't pad. Cite actual stats. Say explicitly when drawing on consolation data or background prior. If no clear answer, say so honestly.

**dossier**: biographical background only — school, sport history, NTRP, club, frequent partners, when they started padel. Do not repeat anything from the reasoning section: no WPR number, no match record, no W/L stats, no scores, no rating confidence. The dossier and reasoning should read as completely separate sections. No inference. Max 5. Empty array if nothing found.`;
}

function formatMatches(matches: any[]): string {
  const competitive = matches
    .filter(m => m.drawType === "MAIN" || m.drawType === "ROUND_ROBIN")
    .slice(0, 25);

  if (!competitive.length) return "No competitive match data available.";

  const overflow = matches.filter(m => m.drawType === "MAIN" || m.drawType === "ROUND_ROBIN").length - competitive.length;

  const header = [
    "COMPETITIVE MATCHES — most recent first (MAIN + ROUND_ROBIN only)",
    "─".repeat(90),
    "Date        Type         W/L  My WPR  Partner (WPR / conf)           Opp avg  Scores",
    "─".repeat(90),
  ];

  const rows = competitive.map(m => {
    const wl       = m.walkover ? "WO"  : m.win ? "W" : "L";
    const myR      = m.myRating != null ? m.myRating.toFixed(2) : "—   ";
    const pName    = (m.partner?.name || "Unknown").slice(0, 18).padEnd(18);
    const pRat     = m.partner?.rating != null ? m.partner.rating.toFixed(1) : "—  ";
    const pConf    = (m.partner?.confidence ?? "?").slice(0, 3).toUpperCase();
    const oppR     = m.oppAvgRating != null ? m.oppAvgRating.toFixed(2) : "—   ";
    const type     = `${m.drawType} ${m.round ?? ""}`.slice(0, 12).padEnd(12);
    const scores   = m.walkover
      ? "walkover"
      : (m.sets ?? []).map((s: any) => `${s.teamA}-${s.teamB}`).join(", ") || "—";

    return `${m.date}  ${type}  ${wl.padEnd(3)}  ${myR}  ${pName} (${pRat} / ${pConf})  ${oppR}   ${scores}`;
  });

  const lines = [...header, ...rows];
  if (overflow > 0) lines.push(`... and ${overflow} more earlier match(es) reflected in the summary stats above`);
  return lines.join("\n");
}

function formatBrief(wpr: number, b: MatchBrief): string {
  const lines: string[] = [];

  lines.push(`MATCH BRIEF`);
  lines.push(`────────────`);
  lines.push(`Competitive matches (MAIN + ROUND_ROBIN): ${b.competitiveCount}`);
  lines.push(
    `  Walkovers: ${b.walkovers}  |  Real played: ${b.realPlayed}  |  Wins: ${b.wins}  |  Losses: ${b.losses}`,
  );
  lines.push(``);

  lines.push(`Partner signal:`);
  lines.push(`  Partner weaker than opponents: ${b.partnerWeakerThanOpp}`);
  const deltaDir =
    b.avgPartnerDelta < 0
      ? "partner rated lower than opponents on avg"
      : "partner rated higher than opponents on avg";
  lines.push(
    `  Avg partner delta: ${b.avgPartnerDelta.toFixed(2)} pts (${deltaDir})`,
  );
  lines.push(`  Stronger than own partner: ${b.partnerStrongerThanSelf}`);
  lines.push(`  Playing up vs opponents: ${b.playingUp}`);
  lines.push(``);

  lines.push(`Score margins (real played only):`);
  lines.push(
    `  Close losses (all sets within 3 games): ${b.closeCompetitiveLosses}`,
  );
  lines.push(`  Dominant wins (all sets lopsided): ${b.dominantWins}`);
  lines.push(``);

  lines.push(`Trajectory:`);
  lines.push(
    `  Delta over window: ${b.trajectoryDelta >= 0 ? "+" : ""}${b.trajectoryDelta.toFixed(1)} WPR pts`,
  );
  lines.push(`  Direction: ${b.trajectoryDirection}`);
  lines.push(
    `  Volatility: ${b.volatility ? "HIGH — rating swings >2.0 pts across matches" : "normal"}`,
  );
  lines.push(``);

  lines.push(`Performance by period:`);
  for (const bk of b.buckets) {
    if (bk.matches === 0) continue;
    const myR = bk.myMedianRating != null ? bk.myMedianRating.toFixed(1) : "—";
    const oppR =
      bk.oppMedianRating != null ? bk.oppMedianRating.toFixed(1) : "—";
    lines.push(
      `  ${bk.period.padEnd(18)} ${bk.matches} matches  ${bk.wins}W ${bk.losses}L  my median ${myR}  opp median ${oppR}`,
    );
  }
  lines.push(``);

  lines.push(`Partner diversity: ${b.uniquePartners} unique partner(s)`);

  if (b.consolation.length > 0) {
    lines.push(``);
    lines.push(
      `Consolation matches (context only — not counted in competitive total):`,
    );
    for (const m of b.consolation) {
      if (m.walkover) continue;
      const result = m.win ? "W" : "L";
      const opp =
        m.oppAvgRating != null
          ? `opp avg ${m.oppAvgRating.toFixed(1)}`
          : "opp avg unknown";
      const sets = m.sets.length
        ? m.sets.map((s: any) => `${s.teamA}-${s.teamB}`).join(", ")
        : "—";
      lines.push(`  ${m.date}  ${result}  ${opp}  ${sets}`);
    }
  }

  return lines.join("\n");
}
