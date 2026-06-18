import type { Candidate, RateResponse } from "./types";

export async function searchPlayers(q: string): Promise<Candidate[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.candidates;
}

export async function ratePlayer(id: string, name: string): Promise<RateResponse> {
  const res = await fetch(`/api/rate/${id}?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error("Rating failed");
  return res.json();
}
