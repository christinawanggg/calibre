import { useState } from "react";
import type { RateResponse } from "../types";

interface Props {
  data: RateResponse;
  onReset: () => void;
}

function photoUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const key = raw.startsWith("/") ? raw.slice(1) : raw;
  const payload = JSON.stringify({
    bucket: "redpadel-production-ui-files",
    key,
    edits: {
      resize: {
        width: 128,
        height: 128,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    },
  });
  return `https://d122z1d8jk9gd0.cloudfront.net/${btoa(payload)}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DIRECTIONAL_LABEL: Record<string, string> = {
  underrated: "Underrated",
  about_right: "About right",
  overrated: "Overrated",
};

const DIRECTIONAL_COLOR: Record<string, string> = {
  underrated: "#22c55e",
  about_right: "#a3a3a3",
  overrated: "#ef4444",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "#2563eb",
  MEDIUM: "#7c3aed",
  LOW: "#d97706",
  INSUFFICIENT: "#6b7280",
};

const TRAJECTORY_LABEL: Record<string, string> = {
  improving: "↑ Improving",
  stable: "→ Stable",
  declining: "↓ Declining",
};

export function RatingCard({ data, onReset }: Props) {
  const [bgOpen, setBgOpen] = useState(false);
  const { player, rating } = data;
  const showNumber =
    rating.confidence === "HIGH" || rating.confidence === "MEDIUM";
  const url = photoUrl(player.photo);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            flexShrink: 0,
            overflow: "hidden",
            background: "#2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            color: "#888",
          }}
        >
          {url ? (
            <img
              src={url}
              alt={player.name}
              width={48}
              height={48}
              style={{ objectFit: "cover" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            initials(player.name)
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {player.name}
            </h2>
            <span
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 99,
                background: CONFIDENCE_COLOR[rating.confidence] + "22",
                color: CONFIDENCE_COLOR[rating.confidence],
                fontWeight: 600,
              }}
            >
              {rating.confidence}
            </span>
          </div>
          <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
            {[
              player.wprRating != null
                ? `WPR ${player.wprRating.toFixed(2)}`
                : null,
              player.gender,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>

      {/* Verdict row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        {rating.directional && (
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: DIRECTIONAL_COLOR[rating.directional],
            }}
          >
            {DIRECTIONAL_LABEL[rating.directional]}
          </div>
        )}
        {showNumber && rating.estimate && (
          <div style={{ fontSize: 16, color: "#d4d4d8" }}>
            {rating.estimate.low} – {rating.estimate.high}
          </div>
        )}
        {showNumber && rating.trajectory && (
          <div style={{ fontSize: 14, color: "#888" }}>
            {TRAJECTORY_LABEL[rating.trajectory]}
          </div>
        )}
      </div>

      {/* Reasoning */}
      {rating.reasoning.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: 10,
            }}
          >
            Reasoning
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {rating.reasoning.map((b, i) => (
              <li
                key={i}
                style={{ color: "#d4d4d8", fontSize: 14, lineHeight: 1.5 }}
              >
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dossier */}
      {rating.dossier.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: 10,
            }}
          >
            Dossier
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {rating.dossier.map((b, i) => (
              <li
                key={i}
                style={{ color: "#d4d4d8", fontSize: 14, lineHeight: 1.5 }}
              >
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Background (collapsed) */}
      {rating.backgroundSummary && (
        <section style={{ marginBottom: 20 }}>
          <button
            onClick={() => setBgOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#888",
              }}
            >
              Background
            </span>
            <span style={{ color: "#555", fontSize: 12 }}>
              {bgOpen ? "▲" : "▼"}
            </span>
          </button>
          {bgOpen && (
            <p
              style={{
                marginTop: 8,
                color: "#a1a1aa",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {rating.backgroundSummary}
            </p>
          )}
        </section>
      )}

      <button
        onClick={onReset}
        style={{
          marginTop: 8,
          padding: "8px 16px",
          fontSize: 14,
          background: "none",
          border: "1px solid #333",
          borderRadius: 6,
          color: "#888",
          cursor: "pointer",
        }}
      >
        Search again
      </button>
    </div>
  );
}
