// ─── Domain types ──────────────────────────────────────────────────────────────

export type Confidence  = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type Directional = "underrated" | "about_right" | "overrated";
export type Trajectory  = "improving" | "stable" | "declining";

export interface MatchBrief {
  competitiveCount: number;
  walkovers: number;
  realPlayed: number;
  wins: number;
  losses: number;
  // counts — denominator is always competitiveCount
  partnerWeakerThanOpp: number;
  partnerStrongerThanSelf: number;
  playingUp: number;
  avgPartnerDelta: number;
  trajectoryDelta: number;
  trajectoryDirection: Trajectory;
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
  directional?: Directional;
  confidence: Confidence;
  trajectory?: Trajectory;
  reasoning: string[];
  dossier: string[];
  backgroundSummary?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MODEL                = "claude-sonnet-4-6";
export const MATCH_WINDOW_YEARS   = 1;
export const MATCH_FETCH_LIMIT    = 200;
export const MS_PER_DAY           = 86_400_000;
export const TOP_CANDIDATES       = 3;
export const VOLATILITY_THRESHOLD = 2.0;
export const TRAJECTORY_THRESHOLD = 0.3;

export const TOOL = {
  WEB_SEARCH:    "web_search",
  FIND_PLAYER:   "find_player",
  GET_PLAYER:    "get_player",
  GET_MATCHES:   "get_matches",
  OUTPUT_RATING: "output_rating",
} as const;
