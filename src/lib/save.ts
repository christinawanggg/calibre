import { db, players, playerRatings, playerBackgrounds } from "./db";
import { ratingExpiresAt, backgroundExpiresAt } from "./expiry";
import type { RatingResult } from "../types";

export async function saveRun(playerProfile: any, refined: RatingResult): Promise<void> {
  const name     = `${playerProfile.firstName ?? ""} ${playerProfile.lastName ?? ""}`.trim();
  const wprValue = playerProfile.ratingVerified?.value ?? playerProfile.rating?.value ?? null;

  console.log(`\n── Saving to database...`);

  // 1. Upsert player row
  const [player] = await db
    .insert(players)
    .values({
      wprId:    playerProfile._id,
      name,
      gender:   playerProfile.gender ?? null,
      photoUrl: playerProfile.photo  ?? null,
    })
    .onConflictDoUpdate({
      target: players.wprId,
      set:    { name, gender: playerProfile.gender ?? null, photoUrl: playerProfile.photo ?? null },
    })
    .returning();
  console.log(`  → player: ${name} (${player.id})`);

  // 2. Append rating row (always — cache check happens at the route layer)
  await db.insert(playerRatings).values({
    playerId:     player.id,
    wprRating:    wprValue != null ? String(wprValue) : null,
    confidence:   refined.confidence,
    directional:  refined.directional  ?? null,
    trajectory:   refined.trajectory   ?? null,
    estimateLow:  refined.estimate?.low  != null ? String(refined.estimate.low)  : null,
    estimateHigh: refined.estimate?.high != null ? String(refined.estimate.high) : null,
    reasoning:    refined.reasoning,
    dossier:      refined.dossier,
    expiresAt:    ratingExpiresAt(),
  });
  console.log(`  → rating: ${refined.confidence}${refined.directional ? ` / ${refined.directional}` : ""}`);

  // 3. Save background (NULL = searched, nothing found — always insert so we know we searched)
  await db.insert(playerBackgrounds).values({
    playerId:   player.id,
    background: refined.backgroundSummary ?? null,
    expiresAt:  backgroundExpiresAt(),
  });
  console.log(`  → background: ${refined.backgroundSummary ? "saved" : "empty (searched, nothing found)"}`);

  console.log(`✓ Saved`);
}
