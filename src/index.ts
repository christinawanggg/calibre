import { authenticateWPR } from "./wpr";
import { runAgent, refine } from "./agent";
import { saveRun } from "./lib/save";
import { sql } from "./lib/db";
import type { RatingResult } from "./types";

// ─── Render ────────────────────────────────────────────────────────────────────

function render(playerName: string, wpr: number, result: RatingResult): void {
  const line      = "─".repeat(56);
  const showNumber = result.confidence === "HIGH" || result.confidence === "MEDIUM";

  console.log(`\n${line}`);
  console.log(`PADELIQ — ${playerName}`);
  console.log(line);
  console.log(`WPR:         ${wpr.toFixed(2)}`);

  if (showNumber && result.estimate) {
    console.log(`Estimate:    ${result.estimate.low} – ${result.estimate.high}    (${result.confidence} confidence)`);
  } else if (result.confidence === "LOW") {
    console.log(`Confidence:  LOW — directional only, not enough data for a number`);
  } else if (result.confidence === "INSUFFICIENT") {
    console.log(`Confidence:  INSUFFICIENT — not enough data`);
  }

  if (result.directional) {
    const label = result.directional === "underrated" ? "Underrated"
                : result.directional === "overrated"  ? "Overrated"
                : "About right";
    console.log(`Verdict:     ${label}`);
  }

  if (showNumber && result.trajectory) {
    const label = result.trajectory === "improving" ? "Improving"
                : result.trajectory === "declining"  ? "Declining"
                : "Stable";
    console.log(`Trajectory:  ${label}`);
  }

  if (result.reasoning.length) {
    console.log(`\nREASONING`);
    result.reasoning.forEach((bullet) => console.log(`  • ${bullet}`));
  }

  if (result.dossier.length) {
    console.log(`\nDOSSIER`);
    result.dossier.forEach((bullet) => console.log(`  • ${bullet}`));
  }

  if (result.backgroundSummary) {
    console.log(`\nBACKGROUND`);
    console.log(`  ${result.backgroundSummary}`);
  }

  console.log(`\n${line}`);
}

// ─── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const playerName = process.argv[2];
  if (!playerName) {
    console.error('Usage: bun run src/index.ts "Player Name"');
    process.exit(1);
  }

  console.log("🔑 Authenticating with WPR...");
  const token = await authenticateWPR();
  console.log("✅ Got Bearer token\n");

  const { result, playerProfile } = await runAgent(playerName, token);
  const refined                   = await refine(result);

  if (playerProfile) {
    await saveRun(playerProfile, refined);
  }

  const wpr = playerProfile?.ratingVerified?.value ?? playerProfile?.rating?.value ?? 0;
  render(playerName, wpr, refined);
  await sql.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
