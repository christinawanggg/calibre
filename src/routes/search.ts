import { Hono } from "hono";
import { searchPlayers, getPlayer } from "../wpr";
import { getToken } from "../lib/auth";
import { TOP_CANDIDATES } from "../types";

const route = new Hono();

route.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ error: "q is required" }, 400);

  try {
    const token   = await getToken();
    const results = await searchPlayers(q, token);

    const candidates = await Promise.all(
      results.slice(0, TOP_CANDIDATES).map(async (r: any) => {
        try {
          const p = await getPlayer(r.id, token);
          return {
            id:          p._id,
            name:        `${p.firstName} ${p.lastName}`.trim(),
            country:     p.countryIsoCode ?? null,
            gender:      p.gender         ?? null,
            age:         p.age            ?? null,
            wprSocial:   p.rating?.value          ?? null,
            wprVerified: p.ratingVerified?.value   ?? null,
            confidence:  p.competitionRatingConfidenceLevel ?? null,
            photo:       p.photo          ?? null,
          };
        } catch {
          return {
            id:          r.id,
            name:        r.title,
            country:     null,
            gender:      null,
            age:         null,
            wprSocial:   r.rpr ?? null,
            wprVerified: null,
            confidence:  r.competitionRatingConfidenceLevel ?? null,
            photo:       null,
          };
        }
      }),
    );

    return c.json({ candidates });
  } catch (err) {
    console.error("Search error:", err);
    return c.json({ error: "Search failed" }, 500);
  }
});

export default route;
