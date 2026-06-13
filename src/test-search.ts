import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PLAYERS = [
  "Francesca La O",
  "Aitana Comas",
  "Marianna Alevra",
  "Nieve Monderer",
];

async function searchRacketBackground(name: string) {
  console.log(`\n${"─".repeat(56)}`);
  console.log(`🔍  ${name}`);
  console.log("─".repeat(56));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [
      { type: "web_search_20250305" as any, name: "web_search" },
    ],
    messages: [
      {
        role: "user",
        content: `Find all racket sport background for the person named "${name}". They are likely a padel player based in the US.

Search for each of these separately:
1. site:tennisrecord.com "${name}" — USTA match history and NTRP rating
2. "${name}" college tennis — ITA records, college roster
3. "${name}" tennis recruiting OR junior tennis — high school/junior tennis history
4. "${name}" ITF OR WTA OR ATP OR pro tennis — any pro tournament history
5. "${name}" squash OR pickleball — other racket sport backgrounds

For each search, report:
- What you found (be specific: school name, rating level, ranking, years, etc.)
- How confident you are it's the right person (HIGH / MEDIUM / LOW)

If a category turns up nothing, just write "not found". Be concise — one or two lines per category max.`,
      },
    ],
  });

  for (const block of response.content) {
    if (block.type === "text") console.log(block.text);
  }
}

async function main() {
  const target = process.argv[2];
  const players = target ? [target] : PLAYERS;

  for (const name of players) {
    await searchRacketBackground(name);
  }
}

main().catch(console.error);
