export interface Candidate {
  id: string;
  name: string;
  country: string | null;
  gender: string | null;
  age: number | null;
  wprSocial: number | null;
  wprVerified: number | null;
  confidence: string | null;
  photo: string | null;
}

export interface Rating {
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  directional?: "underrated" | "about_right" | "overrated";
  trajectory?: "improving" | "stable" | "declining";
  estimate?: { low: number; high: number };
  reasoning: string[];
  dossier: string[];
  backgroundSummary?: string;
  cached: boolean;
  cachedAt?: string;
}

export interface RateResponse {
  player: {
    wprId: string;
    name: string;
    gender: string | null;
    wprRating: number | null;
    photo: string | null;
  };
  rating: Rating;
}
