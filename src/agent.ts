import Anthropic from "@anthropic-ai/sdk";
import { agentPrompt } from "./prompts/agent";
import { searchPlayers, getPlayer, getMatches } from "./wpr";
import {
  MODEL, MATCH_WINDOW_YEARS, MS_PER_DAY, TOP_CANDIDATES,
  VOLATILITY_THRESHOLD, TRAJECTORY_THRESHOLD, TOOL,
  type MatchBrief, type RatingResult, type Trajectory,
} from "./types";

// ─── Tool definitions ──────────────────────────────────────────────────────────

const outputRatingTool: Anthropic.Tool = {
  name: TOOL.OUTPUT_RATING,
  description: "Output the final PadelIQ rating estimate for this player.",
  input_schema: {
    type: "object" as const,
    properties: {
      estimate: {
        type: "object",
        description: "Rating range. Omit entirely if confidence is INSUFFICIENT.",
        properties: {
          low:  { type: "number" },
          high: { type: "number" },
        },
        required: ["low", "high"],
      },
      directional: {
        type: "string",
        enum: ["underrated", "about_right", "overrated"],
        description: "Omit entirely if confidence is INSUFFICIENT.",
      },
      confidence: {
        type: "string",
        enum: ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"],
      },
      trajectory: {
        type: "string",
        enum: ["improving", "stable", "declining"],
        description: "Omit if confidence is LOW or INSUFFICIENT.",
      },
      reasoning: {
        type: "array",
        items: { type: "string" },
        description: "As many bullets as genuinely needed, max 5. Don't pad.",
      },
      dossier: {
        type: "array",
        items: { type: "string" },
        description:
          "Biographical background only — school, sport history, NTRP, club, frequent partners, when they started padel. No WPR number, no match record, no W/L stats, no scores, no rating confidence. Max 5. Empty array if nothing found.",
      },
    },
    required: ["confidence", "reasoning", "dossier"],
  },
};

const tools: Anthropic.Tool[] = [
  { type: "web_search_20250305", name: TOOL.WEB_SEARCH, max_uses: 14 } as any,
  {
    name: TOOL.FIND_PLAYER,
    description:
      "Search for a padel player on World Padel Rating and return enriched candidate profiles. Pass any context you have about this person — region, club, known partners, approximate rating, gender, anything — to help identify the right match. Returns top candidates with full profile data (country, age, gender, rating, confidence) so you can pick the right one without additional calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:   { type: "string", description: "Name or partial name to search for" },
        context: { type: "string", description: "Any context you have about this person that helps identify the right match — region, club, known partners, approximate rating, gender, etc." },
      },
      required: ["query"],
    },
  },
  {
    name: TOOL.GET_PLAYER,
    description:
      "Get full player profile by WPR user ID. Use this if you already have the player ID and didn't go through find_player, or need to re-fetch a specific profile.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "WPR user _id (MongoDB ObjectId)" },
      },
      required: ["id"],
    },
  },
  {
    name: TOOL.GET_MATCHES,
    description:
      "Get match history for a player by their WPR user ID. Returns all verified matches from the last 12 months with raw match rows plus pre-computed summary stats.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "WPR user _id" },
      },
      required: ["userId"],
    },
  },
  outputRatingTool,
];

// ─── Agent loop ────────────────────────────────────────────────────────────────

const client = new Anthropic();

export async function runAgent(
  playerName: string,
  token: string,
): Promise<{ userId: string | null; result: RatingResult }> {
  console.log(`\n🎾 PadelIQ — looking up "${playerName}"\n`);

  let userId: string | null    = null;
  let rating: RatingResult | null = null;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: agentPrompt(playerName) },
  ];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      if (response.stop_reason === "max_tokens")
        console.log("[Warning: agent output truncated]");
      if (!rating)
        console.warn("[Warning: agent ended without calling output_rating]");
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const input = block.input as any;
        console.log(`  → [tool] ${block.name}(${JSON.stringify(input)})`);

        let toolResult: any;
        try {
          if (block.name === TOOL.FIND_PLAYER) {
            const candidates = await searchPlayers(input.query, token);
            toolResult = await Promise.all(
              candidates.slice(0, TOP_CANDIDATES).map(async (c: any) => {
                try {
                  const p = await getPlayer(c.id, token);
                  return {
                    id:          p._id,
                    name:        `${p.firstName} ${p.lastName}`.trim(),
                    country:     p.countryIsoCode ?? null,
                    gender:      p.gender ?? null,
                    age:         p.age ?? null,
                    wprSocial:   p.rating?.value ?? null,
                    wprVerified: p.ratingVerified?.value ?? null,
                    confidence:  p.competitionRatingConfidenceLevel ?? null,
                  };
                } catch {
                  return {
                    id:         c.id,
                    name:       c.title,
                    wprSocial:  c.rpr ?? null,
                    confidence: c.competitionRatingConfidenceLevel ?? null,
                  };
                }
              }),
            );
          } else if (block.name === TOOL.GET_PLAYER) {
            toolResult = await getPlayer(input.id, token);
          } else if (block.name === TOOL.GET_MATCHES) {
            userId = input.userId;

            const cutoff   = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - MATCH_WINDOW_YEARS);

            const raw      = await getMatches(input.userId, token);
            const verified = raw.filter((m: any) => m.verified === true);
            const recent   = verified.filter((m: any) => new Date(m.date) >= cutoff);

            const matches = recent.map((m: any) => {
              const sets    = m.sets?.filter((s: any) => s.teamA > 0 || s.teamB > 0) ?? [];
              const me      = m.users.find((u: any) => u._id === input.userId);
              const partner = m.users.find((u: any) => u._id !== input.userId && u.team === me?.team);
              const opps    = m.users.filter((u: any) => u.team !== me?.team);
              const oppAvg  = opps.length
                ? opps.reduce((sum: number, u: any) => sum + (u.ratingBefore?.value ?? 0), 0) / opps.length
                : null;

              return {
                date:         m.date?.slice(0, 10),
                drawType:     m.drawType ?? "MAIN",
                round:        m.round,
                eventName:    m.eventName,
                walkover:     sets.length === 0,
                status:       m.status ?? null,
                win:          m.winner === me?.team,
                myRating:     me?.ratingBefore?.value ?? null,
                partner: {
                  id:         partner?._id ?? null,
                  name:       `${partner?.data?.firstName ?? ""} ${partner?.data?.lastName ?? ""}`.trim(),
                  rating:     partner?.ratingBefore?.value ?? null,
                  confidence: partner?.data?.competitionRatingConfidenceLevel ?? null,
                },
                oppAvgRating: oppAvg,
                sets,
              };
            });

            const brief = prepareBrief(matches);
            toolResult  = { matches, stats: formatBrief(brief) };
          } else if (block.name === TOOL.OUTPUT_RATING) {
            rating     = block.input as RatingResult;
            toolResult = { recorded: true };
          } else {
            throw new Error(`Unknown tool: ${block.name}`);
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(toolResult) });
        } catch (err) {
          console.error(`  ✗ Tool error: ${err}`);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${err}`, is_error: true });
        }
      }

      messages.push({ role: "user", content: toolResults });
      if (rating) break;
      continue;
    }

    console.error(`Unexpected stop_reason: ${response.stop_reason}`);
    break;
  }

  const fallback: RatingResult = {
    confidence: "INSUFFICIENT",
    reasoning:  ["Agent did not commit to a rating."],
    dossier:    [],
  };
  return { userId, result: rating ?? fallback };
}

// ─── Match analysis ────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round1(n: number): number { return Math.round(n * 10)  / 10;  }
function round2(n: number): number { return Math.round(n * 100) / 100; }

function prepareBrief(matches: any[]): MatchBrief {
  const competitive   = matches.filter((m) => m.drawType === "MAIN" || m.drawType === "ROUND_ROBIN");
  const consolationRaw = matches.filter((m) => m.drawType === "CONSOLATION");
  const real          = competitive.filter((m) => !m.walkover);

  let wins = 0, losses = 0;
  let partnerWeakerCount = 0, partnerStrongerCount = 0, playingUpCount = 0;
  let partnerDeltaSum = 0, partnerDeltaCount = 0;
  let closeCompetitiveLosses = 0, dominantWins = 0;
  const partnerIds = new Set<string>();

  for (const m of competitive) {
    if (m.partner?.id) partnerIds.add(m.partner.id);
    if (m.win) wins++; else losses++;

    if (m.partner?.rating != null && m.oppAvgRating != null && m.myRating != null) {
      const delta = m.partner.rating - m.oppAvgRating;
      if (!m.walkover) { partnerDeltaSum += delta; partnerDeltaCount++; }
      if (m.partner.rating < m.oppAvgRating) partnerWeakerCount++;
      if (m.myRating > m.partner.rating)     partnerStrongerCount++;
      if (m.myRating < m.oppAvgRating)       playingUpCount++;
    }

    if (!m.walkover && m.sets?.length) {
      const allClose    = m.sets.every((s: any) => Math.min(s.teamA, s.teamB) >= 3);
      const allDominant = m.sets.every((s: any) => Math.min(s.teamA, s.teamB) <= 1);
      if (!m.win && allClose)  closeCompetitiveLosses++;
      if (m.win && allDominant) dominantWins++;
    }
  }

  const sortedByDate = [...competitive]
    .filter((m) => m.myRating)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trajectoryDelta = sortedByDate.length >= 2
    ? round1(sortedByDate.at(-1)!.myRating - sortedByDate[0].myRating)
    : 0;
  const trajectoryDirection: Trajectory =
    trajectoryDelta >  TRAJECTORY_THRESHOLD ? "improving" :
    trajectoryDelta < -TRAJECTORY_THRESHOLD ? "declining"  : "stable";

  const ratingValues = competitive.filter((m) => m.myRating).map((m) => m.myRating as number);
  const volatility   = ratingValues.length >= 4 &&
    Math.max(...ratingValues) - Math.min(...ratingValues) > VOLATILITY_THRESHOLD;

  const now     = Date.now();
  const buckets = [
    { period: "Last 3 months",   min: 0,   max: 90  },
    { period: "3–6 months ago",  min: 90,  max: 180 },
    { period: "6–12 months ago", min: 180, max: 365 },
  ].map(({ period, min, max }) => {
    const inBucket = competitive.filter((m) => {
      const days = (now - new Date(m.date).getTime()) / MS_PER_DAY;
      return days >= min && days < max;
    });
    return {
      period,
      matches: inBucket.length,
      wins:    inBucket.filter((m) =>  m.win).length,
      losses:  inBucket.filter((m) => !m.win).length,
      myMedianRating:  median(inBucket.filter((m) => m.myRating).map((m) => m.myRating as number)),
      oppMedianRating: median(inBucket.filter((m) => m.oppAvgRating).map((m) => m.oppAvgRating as number)),
    };
  });

  return {
    competitiveCount:        competitive.length,
    walkovers:               competitive.filter((m) => m.walkover).length,
    realPlayed:              real.length,
    wins,
    losses,
    partnerWeakerThanOpp:    partnerWeakerCount,
    partnerStrongerThanSelf: partnerStrongerCount,
    playingUp:               playingUpCount,
    avgPartnerDelta:         partnerDeltaCount > 0 ? round2(partnerDeltaSum / partnerDeltaCount) : 0,
    trajectoryDelta,
    trajectoryDirection,
    closeCompetitiveLosses,
    dominantWins,
    uniquePartners:          partnerIds.size,
    volatility,
    buckets,
    consolation: consolationRaw.map((m) => ({
      date:         m.date,
      win:          m.win,
      myRating:     m.myRating ?? null,
      oppAvgRating: m.oppAvgRating ?? null,
      partnerRating: m.partner?.rating ?? null,
      sets:         m.sets ?? [],
      walkover:     m.walkover ?? false,
    })),
  };
}

function formatBrief(b: MatchBrief): string {
  const n     = b.competitiveCount;
  const lines = [
    `MATCH BRIEF`,
    `────────────`,
    `Competitive matches (MAIN + ROUND_ROBIN): ${n}`,
    `  Walkovers: ${b.walkovers}  |  Real played: ${b.realPlayed}  |  Wins: ${b.wins}  |  Losses: ${b.losses}`,
    ``,
    `Partner signal:`,
    `  Partner weaker than opponents: ${b.partnerWeakerThanOpp}/${n}`,
    `  Avg partner delta: ${b.avgPartnerDelta.toFixed(2)} pts (${b.avgPartnerDelta < 0 ? "partner rated lower than opponents on avg" : "partner rated higher than opponents on avg"})`,
    `  Stronger than own partner: ${b.partnerStrongerThanSelf}/${n}`,
    `  Playing up vs opponents: ${b.playingUp}/${n}`,
    ``,
    `Score margins (real played only):`,
    `  Close losses (all sets within 3 games): ${b.closeCompetitiveLosses}`,
    `  Dominant wins (all sets lopsided): ${b.dominantWins}`,
    ``,
    `Trajectory:`,
    `  Delta over window: ${b.trajectoryDelta >= 0 ? "+" : ""}${b.trajectoryDelta.toFixed(1)} WPR pts`,
    `  Direction: ${b.trajectoryDirection}`,
    `  Volatility: ${b.volatility ? "HIGH — rating swings >2.0 pts across matches" : "normal"}`,
    ``,
    `Performance by period:`,
  ];

  for (const bk of b.buckets) {
    if (bk.matches === 0) continue;
    const myR  = bk.myMedianRating  != null ? bk.myMedianRating.toFixed(1)  : "—";
    const oppR = bk.oppMedianRating != null ? bk.oppMedianRating.toFixed(1) : "—";
    lines.push(`  ${bk.period.padEnd(18)} ${bk.matches} matches  ${bk.wins}W ${bk.losses}L  my median ${myR}  opp median ${oppR}`);
  }

  lines.push(``, `Partner diversity: ${b.uniquePartners} unique partner(s)`);

  if (b.consolation.length > 0) {
    lines.push(``, `Consolation matches (context only — not counted in competitive total):`);
    for (const m of b.consolation) {
      if (m.walkover) continue;
      const sets = m.sets.length ? m.sets.map((s: any) => `${s.teamA}-${s.teamB}`).join(", ") : "—";
      const opp  = m.oppAvgRating != null ? `opp avg ${m.oppAvgRating.toFixed(1)}` : "opp avg unknown";
      lines.push(`  ${m.date}  ${m.win ? "W" : "L"}  ${opp}  ${sets}`);
    }
  }

  return lines.join("\n");
}
