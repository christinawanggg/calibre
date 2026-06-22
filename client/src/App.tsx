import { useState } from "react";
import { SearchDropdown } from "./components/SearchDropdown";
import { RatingCard } from "./components/RatingCard";
import { AgentLoader } from "./components/AgentLoader";
import { ratePlayer } from "./api";
import { C } from "./lib/tokens";
import type { Candidate, RateResponse } from "./types";

type AppState =
  | { stage: "idle" }
  | { stage: "rating"; candidate: Candidate }
  | { stage: "done"; data: RateResponse }
  | { stage: "error"; message: string };

export default function App() {
  const [state, setState] = useState<AppState>({ stage: "idle" });

  async function handleSelect(candidate: Candidate) {
    setState({ stage: "rating", candidate });
    try {
      const data = await ratePlayer(candidate.id, candidate.name);
      setState({ stage: "done", data });
    } catch {
      setState({ stage: "error", message: "Rating failed. Try again." });
    }
  }

  const reset = () => setState({ stage: "idle" });

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: "-0.02em",
            color: C.ink,
          }}
        >
          RealPadelRating
        </h1>
        <p style={{ color: C.dust, fontSize: 15, marginBottom: 36 }}>
          The rating WPR isn't telling you
        </p>

        {(state.stage === "idle" || state.stage === "error") && (
          <>
            <SearchDropdown onSelect={handleSelect} disabled={false} />
            {state.stage === "error" && (
              <p style={{ marginTop: 16, color: C.oxblood.dark, fontSize: 14 }}>
                {state.message}
              </p>
            )}
          </>
        )}

        {state.stage === "rating" && (
          <AgentLoader playerName={state.candidate.name} />
        )}

        {state.stage === "done" && (
          <RatingCard data={state.data} onReset={reset} />
        )}
      </div>
    </div>
  );
}
