import Anthropic from "@anthropic-ai/sdk";
import { gatherPrompt } from "./prompts/gather";
import { synthesizePrompt } from "./prompts/synthesize";

const WPR_GRAPHQL = "https://api.redpadel.com/graphql";
const client = new Anthropic();

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MatchBrief {
  competitiveCount: number;
  walkovers: number;
  realPlayed: number;
  wins: number;
  losses: number;
  partnerWeakerThanOpp: string;
  avgPartnerDelta: number;
  partnerStrongerThanSelf: string;
  playingUp: string;
  trajectoryDelta: number;
  trajectoryDirection: "improving" | "stable" | "declining";
  closeCompetitiveLosses: number;
  dominantWins: number;
  uniquePartners: number;
  volatility: boolean;
  buckets: Array<{
    period: string;
    matches: number;
    wins: number;
    losses: number;
    myMedianRating: number | null;
    oppMedianRating: number | null;
  }>;
  consolation: Array<{
    date: string;
    win: boolean;
    myRating: number | null;
    oppAvgRating: number | null;
    partnerRating: number | null;
    sets: any[];
    walkover: boolean;
  }>;
}

export interface RatingResult {
  estimate?: { low: number; high: number };
  directional?: "underrated" | "about_right" | "overrated";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  trajectory?: "improving" | "stable" | "declining";
  reasoning: string[];
  dossier: string[];
}

// ─── GraphQL helper ────────────────────────────────────────────────────────────

async function gql(
  operationName: string,
  query: string,
  variables: object,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(WPR_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ operationName, query, variables }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as any;
  if (json.errors) throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ─── WPR API functions ─────────────────────────────────────────────────────────

async function authenticateWPR(): Promise<string> {
  const email = process.env.WPR_EMAIL;
  const password = process.env.WPR_PASSWORD;
  if (!email || !password) throw new Error("WPR_EMAIL and WPR_PASSWORD must be set in .env");

  const data = await gql(
    "Login",
    `mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        _id
        token
        refreshToken
      }
    }`,
    { email, password }
  );

  return data.login.token as string;
}

async function searchPlayers(name: string, token: string): Promise<any[]> {
  const data = await gql(
    "Search",
    `query Search($searchInput: SearchInput!) {
      search(searchInput: $searchInput) {
        results {
          id
          title
          image
          type
          account
          rpr
          rprStatus
          rprConfidence
          rprS
          rprSStatus
          rprSConfidence
          socialRatingConfidenceLevel
          competitionRatingConfidenceLevel
        }
      }
    }`,
    { searchInput: { term: name, type: ["user"] } },
    token
  );
  return data.search.results;
}

async function getPlayer(id: string, token: string): Promise<any> {
  const data = await gql(
    "GetUser",
    `query GetUser($id: String!) {
      getUser(_id: $id) {
        _id
        firstName
        lastName
        photo
        createdAt
        rating {
          status
          value
          confidence
        }
        ratingVerified {
          status
          value
          confidence
        }
        hidden
        countryIsoCode
        playerId
        age
        gender
        socialRatingConfidenceLevel
        competitionRatingConfidenceLevel
      }
    }`,
    { id },
    token
  );
  return data.getUser;
}

async function getMatches(
  userId: string,
  token: string,
  limit = 50
): Promise<any[]> {
  const data = await gql(
    "GetMatches",
    `query GetMatches($filters: matchFilterInput, $pagination: PaginationInput, $sort: MatchSortInput) {
      getMatches(filters: $filters, pagination: $pagination, sort: $sort) {
        _id
        winner
        eventName
        category
        drawType
        round
        date
        status
        verified
        format
        users {
          _id
          team
          organizer
          ratingBefore {
            value
            confidence
          }
          ratingAfter {
            value
            confidence
          }
          data {
            _id
            firstName
            lastName
            ratingVerified {
              status
              value
              confidence
            }
            competitionRatingConfidenceLevel
            countryIsoCode
          }
        }
        sets {
          teamA
          teamB
        }
      }
    }`,
    {
      filters: {
        userID: { condition: "EQUAL", value: userId },
      },
      pagination: { limit, skip: 0 },
      sort: { sort: [{ field: "DATE", order: "DESC" }] },
    },
    token
  );
  return data.getMatches;
}

// ─── Tool definitions for Claude ───────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  { type: "web_search_20250305", name: "web_search" } as any,
  {
    name: "find_player",
    description:
      "Search for a padel player on World Padel Rating and return enriched candidate profiles. Pass any context you have about this person — region, club, known partners, approximate rating, gender, anything — to help identify the right match. Returns top candidates with full profile data (country, age, gender, rating, confidence) so you can pick the right one without additional calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Name or partial name to search for",
        },
        context: {
          type: "string",
          description: "Any context you have about this person that helps identify the right match — region, club, known partners, approximate rating, gender, etc.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_player",
    description:
      "Get full player profile by WPR user ID. Use this if you already have the player ID and didn't go through find_player, or need to re-fetch a specific profile.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "WPR user _id (MongoDB ObjectId)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_matches",
    description:
      "Get match history for a player by their WPR user ID. Returns all verified matches from the last 12 months, pre-labeled with win/loss, myRating, partner rating, and opponent average rating.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "WPR user _id",
        },
      },
      required: ["userId"],
    },
  },
];

// ─── Claude managed agent loop ─────────────────────────────────────────────────

async function runAgent(playerName: string, token: string): Promise<{
  userId: string | null;
  matches: any[];
  agentSummary: string;
}> {
  console.log(`\n🎾 PadelIQ — looking up "${playerName}"\n`);

  let storedUserId: string | null  = null;
  let storedMatches: any[]         = [];
  let storedAgentSummary: string   = "";

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: gatherPrompt(playerName) },
  ];

  // Agentic loop
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      if (response.stop_reason === "max_tokens") {
        console.log("[Warning: agent output truncated]");
      }

      // Capture agent's plain-text summary — used as web findings in synthesize()
      storedAgentSummary = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");

      if (storedAgentSummary) {
        console.log(`\n─── Agent summary ───────────────────────────────────────\n`);
        console.log(storedAgentSummary);
      }

      break;
    }

    if (response.stop_reason === "tool_use") {
      // Only push assistant message when we have tools to process
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const input = block.input as any;
        console.log(`  → [tool] ${block.name}(${JSON.stringify(input)})`);

        let result: any;
        try {
          if (block.name === "find_player") {
            const candidates = await searchPlayers(input.query, token);
            // Enrich top 3 candidates with full profiles so agent can disambiguate
            // without needing a separate get_player call
            const top = candidates.slice(0, 3);
            result = await Promise.all(
              top.map(async (c: any) => {
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
                  // Fallback to search-only data if profile fetch fails
                  return {
                    id:         c.id,
                    name:       c.title,
                    wprSocial:  c.rpr ?? null,
                    confidence: c.competitionRatingConfidenceLevel ?? null,
                  };
                }
              })
            );
          } else if (block.name === "get_player") {
            result = await getPlayer(input.id, token);
          } else if (block.name === "get_matches") {
            storedUserId = input.userId; // capture for post-loop player fetch

            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - 1); // 12-month window

            const raw = await getMatches(input.userId, token, 200);
            const verified = raw.filter((m: any) => m.verified === true);
            const withinYear = verified.filter((m: any) => new Date(m.date) >= cutoff);

            result = withinYear.map((m: any) => {
              const sets = m.sets?.filter((s: any) => s.teamA > 0 || s.teamB > 0) ?? [];

              const me      = m.users.find((u: any) => u._id === input.userId);
              const partner = m.users.find((u: any) => u._id !== input.userId && u.team === me?.team);
              const opps    = m.users.filter((u: any) => u.team !== me?.team);
              const oppAvg  = opps.length
                ? opps.reduce((sum: number, u: any) => sum + (u.ratingBefore?.value ?? 0), 0) / opps.length
                : null;

              return {
                date:      m.date?.slice(0, 10),
                drawType:  m.drawType ?? "MAIN",
                round:     m.round,
                eventName: m.eventName,
                walkover:  sets.length === 0,
                status:    m.status ?? null,
                win:       m.winner === me?.team,
                myRating:  me?.ratingBefore?.value ?? null,
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
            storedMatches = result; // capture for compute_rating()
          } else {
            throw new Error(`Unknown tool: ${block.name}`);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error(`  ✗ Tool error: ${err}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — bail cleanly
    console.error(`Unexpected stop_reason: ${response.stop_reason}`);
    break;
  }

  return { userId: storedUserId, matches: storedMatches, agentSummary: storedAgentSummary };
}

// ─── prepareBrief ──────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

function prepareBrief(matches: any[]): MatchBrief {
  const competitive = matches.filter(
    m => m.drawType === "MAIN" || m.drawType === "ROUND_ROBIN"
  );
  const consolationRaw = matches.filter(m => m.drawType === "CONSOLATION");
  const real = competitive.filter(m => !m.walkover);

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
      if (!m.win && allClose)    closeCompetitiveLosses++;
      if ( m.win && allDominant) dominantWins++;
    }
  }

  // Trajectory
  const sorted = [...competitive]
    .filter(m => m.myRating)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trajectoryDelta = sorted.length >= 2
    ? round1(sorted.at(-1)!.myRating - sorted[0].myRating)
    : 0;
  const trajectoryDirection =
    trajectoryDelta > 0.3 ? "improving" : trajectoryDelta < -0.3 ? "declining" : "stable";

  // Volatility
  const ratingValues = competitive.filter(m => m.myRating).map(m => m.myRating as number);
  const volatility = ratingValues.length >= 4 &&
    (Math.max(...ratingValues) - Math.min(...ratingValues)) > 2.0;

  // Buckets
  const now = Date.now();
  const buckets = [
    { period: "Last 3 months",   min: 0,   max: 90  },
    { period: "3–6 months ago",  min: 90,  max: 180 },
    { period: "6–12 months ago", min: 180, max: 365 },
  ].map(({ period, min, max }) => {
    const inBucket = competitive.filter(m => {
      const days = (now - new Date(m.date).getTime()) / 86_400_000;
      return days >= min && days < max;
    });
    return {
      period,
      matches: inBucket.length,
      wins:    inBucket.filter(m =>  m.win).length,
      losses:  inBucket.filter(m => !m.win).length,
      myMedianRating:  median(inBucket.filter(m => m.myRating).map(m => m.myRating as number)),
      oppMedianRating: median(inBucket.filter(m => m.oppAvgRating).map(m => m.oppAvgRating as number)),
    };
  });

  return {
    competitiveCount:       competitive.length,
    walkovers:              competitive.filter(m => m.walkover).length,
    realPlayed:             real.length,
    wins,
    losses,
    partnerWeakerThanOpp:   `${partnerWeakerCount}/${competitive.length}`,
    avgPartnerDelta:        partnerDeltaCount > 0 ? round2(partnerDeltaSum / partnerDeltaCount) : 0,
    partnerStrongerThanSelf:`${partnerStrongerCount}/${competitive.length}`,
    playingUp:              `${playingUpCount}/${competitive.length}`,
    trajectoryDelta,
    trajectoryDirection,
    closeCompetitiveLosses,
    dominantWins,
    uniquePartners:         partnerIds.size,
    volatility,
    buckets,
    consolation: consolationRaw.map(m => ({
      date:          m.date,
      win:           m.win,
      myRating:      m.myRating ?? null,
      oppAvgRating:  m.oppAvgRating ?? null,
      partnerRating: m.partner?.rating ?? null,
      sets:          m.sets ?? [],
      walkover:      m.walkover ?? false,
    })),
  };
}

// ─── synthesize ────────────────────────────────────────────────────────────────

const outputRatingTool: Anthropic.Tool = {
  name: "output_rating",
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
        description: "Omit if confidence is INSUFFICIENT.",
      },
      reasoning: {
        type: "array",
        items: { type: "string" },
        description: "As many bullets as genuinely needed, max 5. Don't pad.",
      },
      dossier: {
        type: "array",
        items: { type: "string" },
        description: "Biographical background only — school, sport history, NTRP, club, frequent partners, when they started padel. No WPR number, no match record, no W/L stats, no scores, no rating confidence. Max 5. Empty array if nothing found.",
      },
    },
    required: ["confidence", "reasoning", "dossier"],
  },
};

async function synthesize(
  playerName: string,
  wpr: number,
  brief: MatchBrief,
  agentSummary: string,
  matches: any[]
): Promise<RatingResult> {
  console.log(`\n── Synthesizing rating...`);

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 2048,
    tools:      [outputRatingTool],
    tool_choice: { type: "tool", name: "output_rating" },
    messages: [{
      role: "user",
      content: synthesizePrompt(playerName, wpr, brief, agentSummary, matches),
    }],
  });

  const toolBlock = response.content.find((b: any) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("synthesize: expected tool_use response, got none");
  }

  return toolBlock.input as RatingResult;
}

// ─── render ────────────────────────────────────────────────────────────────────

function render(playerName: string, wpr: number, result: RatingResult): void {
  const line = "─".repeat(56);
  console.log(`\n${line}`);
  console.log(`PADELIQ — ${playerName}`);
  console.log(line);
  console.log(`WPR:         ${wpr.toFixed(2)}`);

  const showNumber = result.confidence === "HIGH" || result.confidence === "MEDIUM";

  if (showNumber && result.estimate) {
    console.log(`Estimate:    ${result.estimate.low} – ${result.estimate.high}    (${result.confidence} confidence)`);
  } else if (result.confidence === "LOW") {
    console.log(`Confidence:  LOW — directional only, not enough data for a number`);
  } else if (result.confidence === "INSUFFICIENT") {
    console.log(`Confidence:  INSUFFICIENT — not enough data`);
  }

  if (result.directional) {
    const label =
      result.directional === "underrated" ? "Underrated" :
      result.directional === "overrated"  ? "Overrated"  : "About right";
    console.log(`Verdict:     ${label}`);
  }

  if (showNumber && result.trajectory) {
    const label =
      result.trajectory === "improving" ? "Improving" :
      result.trajectory === "declining" ? "Declining" : "Stable";
    console.log(`Trajectory:  ${label}`);
  }

  if (result.reasoning.length) {
    console.log(`\nREASONING`);
    result.reasoning.forEach(b => console.log(`  • ${b}`));
  }

  if (result.dossier.length) {
    console.log(`\nDOSSIER`);
    result.dossier.forEach(b => console.log(`  • ${b}`));
  }

  console.log(`\n${line}`);
}

// ─── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const playerName = process.argv[2];
  if (!playerName) {
    console.error("Usage: bun run src/index.ts \"Player Name\"");
    process.exit(1);
  }

  console.log("🔑 Authenticating with WPR...");
  const token = await authenticateWPR();
  console.log("✅ Got Bearer token\n");

  const { userId, matches, agentSummary } = await runAgent(playerName, token);

  // Fetch player profile for WPR value
  let wpr = 0;
  if (userId) {
    try {
      const player = await getPlayer(userId, token);
      wpr = player.ratingVerified?.value ?? player.rating?.value ?? 0;
    } catch (err) {
      console.error("Could not fetch player profile for WPR:", err);
    }
  }

  const brief  = prepareBrief(matches);
  const result = await synthesize(playerName, wpr, brief, agentSummary, matches);
  render(playerName, wpr, result);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
