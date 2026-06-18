import { authenticateWPR } from "../wpr";

let token: string | null = null;
let fetchedAt = 0;
const TTL_MS = 50 * 60 * 1000; // 50 min — WPR JWTs last ~1h

export async function getToken(): Promise<string> {
  if (token && Date.now() - fetchedAt < TTL_MS) return token;
  token = await authenticateWPR();
  fetchedAt = Date.now();
  return token;
}
