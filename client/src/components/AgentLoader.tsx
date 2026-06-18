import { useState, useEffect } from "react";

const STEPS = [
  "Tracking down their WPR profile",
  "Fetching match history",
  "Figuring out who they've been playing with",
  "Checking if their partners are carrying them",
  "Looking for a tennis background",
  "Hunting for college tennis records",
  "Checking for a squash background",
  "Maybe a pickleball player too?",
  "Searching NTRP ratings",
  "Analyzing trajectory signals",
  "Reading between the score lines",
  "Weighing partner quality adjustments",
  "Sizing up what tier they're really in",
  "Calibrating confidence level",
  "Taking a stance",
  "Polishing the take",
];

const INTERVAL_MS = 2500;

interface Props {
  playerName: string;
}

export function AgentLoader({ playerName }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % STEPS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ paddingTop: 48 }}>
      <style>{`
        @keyframes flash {
          0%   { opacity: 0.2; }
          15%  { opacity: 1; }
          100% { opacity: 0.75; }
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .agent-step { animation: flash 0.5s ease-out forwards; }
        .agent-cursor { animation: blink 1s step-start infinite; }
      `}</style>

      <p style={{ color: "#52525b", fontSize: 13, marginBottom: 24 }}>
        Analyzing {playerName}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "#4ade80", fontSize: 13 }}>→</span>
        <span
          key={index}
          className="agent-step"
          style={{ fontSize: 15, color: "#fff" }}
        >
          {STEPS[index]}
        </span>
        <span className="agent-cursor" style={{ color: "#4ade80", fontSize: 13 }}>▋</span>
      </div>
    </div>
  );
}
