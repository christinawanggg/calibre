import { Hono } from "hono";
import { eq, gt, and, desc } from "drizzle-orm";
import { db, players, playerRatings, playerBackgrounds } from "../lib/db";
import { getToken } from "../lib/auth";
import { getPlayer } from "../wpr";
import { runAgent, refine } from "../agent";
import { saveRun } from "../lib/save";

const route = new Hono();

route.get("/rate/:wprId", async (c) => {
  const wprId    = c.req.param("wprId");
  const nameParam = c.req.query("name");
  const now      = new Date();

  try {
    // 1. Look up player in DB
    const [dbPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.wprId, wprId))
      .limit(1);

    // 2. Check for a fresh cached rating
    if (dbPlayer) {
      const [freshRating] = await db
        .select()
        .from(playerRatings)
        .where(and(eq(playerRatings.playerId, dbPlayer.id), gt(playerRatings.expiresAt, now)))
        .orderBy(desc(playerRatings.createdAt))
        .limit(1);

      if (freshRating) {
        return c.json({
          player: {
            wprId,
            name:      dbPlayer.name,
            gender:    dbPlayer.gender,
            wprRating: freshRating.wprRating ? Number(freshRating.wprRating) : null,
            photo:     dbPlayer.photoUrl ?? null,
          },
          rating: {
            confidence:  freshRating.confidence,
            directional: freshRating.directional  ?? undefined,
            trajectory:  freshRating.trajectory   ?? undefined,
            estimate:    freshRating.estimateLow && freshRating.estimateHigh
                           ? { low: Number(freshRating.estimateLow), high: Number(freshRating.estimateHigh) }
                           : undefined,
            reasoning:   freshRating.reasoning,
            dossier:     freshRating.dossier,
            cached:      true,
            cachedAt:    freshRating.createdAt.toISOString(),
          },
        });
      }
    }

    // 3. Check for fresh background to inject
    let knownBackground: string | undefined;
    if (dbPlayer) {
      const [freshBg] = await db
        .select()
        .from(playerBackgrounds)
        .where(and(eq(playerBackgrounds.playerId, dbPlayer.id), gt(playerBackgrounds.expiresAt, now)))
        .orderBy(desc(playerBackgrounds.createdAt))
        .limit(1);

      if (freshBg) knownBackground = freshBg.background ?? undefined;
    }

    // 4. Resolve player name
    const token = await getToken();
    let playerName: string;
    if (nameParam) {
      playerName = nameParam;
    } else if (dbPlayer) {
      playerName = dbPlayer.name;
    } else {
      const profile = await getPlayer(wprId, token);
      playerName = `${profile.firstName} ${profile.lastName}`.trim();
    }

    // 5. Run agent → refine → save
    const { result, playerProfile } = await runAgent(playerName, token, knownBackground);
    const refined                   = await refine(result);

    if (playerProfile) await saveRun(playerProfile, refined);

    const wprRating = playerProfile?.ratingVerified?.value ?? playerProfile?.rating?.value ?? null;
    const name      = playerProfile
      ? `${playerProfile.firstName} ${playerProfile.lastName}`.trim()
      : playerName;

    return c.json({
      player: { wprId, name, gender: playerProfile?.gender ?? null, wprRating, photo: playerProfile?.photo ?? null },
      rating: {
        confidence:        refined.confidence,
        directional:       refined.directional       ?? undefined,
        trajectory:        refined.trajectory        ?? undefined,
        estimate:          refined.estimate,
        reasoning:         refined.reasoning,
        dossier:           refined.dossier,
        backgroundSummary: refined.backgroundSummary ?? undefined,
        cached:            false,
      },
    });
  } catch (err) {
    console.error("Rate error:", err);
    return c.json({ error: "Rating failed" }, 500);
  }
});

export default route;
