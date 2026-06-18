import { useState } from "react";
import { SearchDropdown } from "./components/SearchDropdown";
import { RatingCard } from "./components/RatingCard";
import { AgentLoader } from "./components/AgentLoader";
import { ratePlayer } from "./api";
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
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
          PadelIQ
        </h1>
        <p style={{ color: "#71717a", fontSize: 15, marginBottom: 36 }}>
          True padel rating — partner-adjusted
        </p>

        {(state.stage === "idle" || state.stage === "error") && (
          <>
            <SearchDropdown onSelect={handleSelect} disabled={false} />
            {state.stage === "error" && (
              <p style={{ marginTop: 16, color: "#ef4444", fontSize: 14 }}>{state.message}</p>
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
