import { useState, useEffect } from "react";
import { C } from "../lib/tokens";

const STEPS = [
  "Tracking down their WPR profile...",
  "Fetching match history...",
  "Figuring out who they've been playing with...",
  "Checking if their partners are carrying them...",
  "Looking for a tennis background...",
  "Hunting for college tennis records...",
  "Checking for a squash background...",
  "Maybe a pickleball player too?...",
  "Searching NTRP ratings...",
  "Analyzing trajectory signals...",
  "Reading between the score lines...",
  "Weighing partner quality adjustments...",
  "Sizing up what tier they're really in...",
  "Calibrating confidence level...",
  "Taking a stance...",
  "Polishing the take...",
];

const INTERVAL_MS = 2500;

interface Props {
  playerName: string;
}

export function AgentLoader({ playerName }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % STEPS.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ paddingTop: 48 }}>
      <style>{`
        @keyframes agent-shimmer {
          0%   { background-position: -300% center; opacity: 0.5; }
          20%  { opacity: 1; }
          100% { background-position: 300% center; opacity: 0.85; }
        }
        .agent-step {
          background: linear-gradient(
            90deg,
            ${C.chalk} 0%,
            ${C.walnut.mid} 25%,
            ${C.ink} 45%,
            ${C.walnut.mid} 65%,
            ${C.chalk} 100%
          );
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: agent-shimmer ${INTERVAL_MS}ms ease-out forwards;
        }
      `}</style>

      <p
        style={{
          color: C.dust,
          fontSize: 13,
          marginBottom: 24,
          fontWeight: 600,
        }}
      >
        Analyzing {playerName}
      </p>

      <span
        key={index}
        className="agent-step"
        style={{ fontSize: 15, fontWeight: 500 }}
      >
        {STEPS[index]}
      </span>
    </div>
  );
}
