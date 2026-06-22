import type { RateResponse } from "../types";
import {
  C,
  VERDICT_CONFIG,
  CONFIDENCE_CONFIG,
  TRAJECTORY_CONFIG,
} from "../lib/tokens";
import { labelStyle, BORDER } from "../lib/theme";
import { Avatar } from "./ui/Avatar";
import { BulletList } from "./ui/BulletList";

interface Props {
  data: RateResponse;
  onReset: () => void;
}

function Divider() {
  return (
    <hr style={{ border: "none", borderTop: BORDER.divider, margin: 0 }} />
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.chalk,
      }}
    >
      {children}
    </h3>
  );
}

export function RatingCard({ data, onReset }: Props) {
  const { player, rating } = data;
  const insufficient = rating.confidence === "INSUFFICIENT";

  const metaCols = [
    // Verdict
    (() => {
      const cfg = rating.directional
        ? VERDICT_CONFIG[rating.directional]
        : null;
      return (
        <div key="verdict" style={{ flex: 1 }}>
          <div style={labelStyle}>Verdict</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: cfg ? cfg.color : C.chalk }}>
            {cfg ? cfg.label : "—"}
          </div>
        </div>
      );
    })(),

    // Trajectory — omit entirely if null
    rating.trajectory
      ? (() => {
          const cfg = TRAJECTORY_CONFIG[rating.trajectory!];
          const { Icon, label, color } = cfg;
          return (
            <div key="trajectory" style={{ flex: 1 }}>
              <div style={labelStyle}>Trajectory</div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Icon size={13} color={color} stroke={2} />
                {label}
              </div>
            </div>
          );
        })()
      : null,

    // Confidence
    (() => {
      const cfg = CONFIDENCE_CONFIG[rating.confidence];
      return (
        <div key="confidence" style={{ flex: 1 }}>
          <div style={labelStyle}>Confidence</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: cfg.color }}>
            {cfg.label}
          </div>
        </div>
      );
    })(),
  ].filter(Boolean);

  return (
    <div
      style={{
        background: C.white,
        border: BORDER.card,
        borderRadius: 14,
        padding: "24px 26px",
      }}
    >
      {/* Header */}
      <div style={{ paddingBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={player.name} photo={player.photo} size={72} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: C.ink }}>
          {player.name}
        </h2>
      </div>

      <Divider />

      {/* Rating block + meta row */}
      <div style={{ paddingTop: 20, paddingBottom: 20 }}>
        {/* Inset rating panel */}
        <div
          style={{
            background: C.parchment,
            borderRadius: 10,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* WPR official */}
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>WPR official</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: C.ink }}>
              {player.wprRating != null ? player.wprRating.toFixed(2) : "—"}
            </div>
          </div>

          {/* Arrow + Our estimate — only shown when there's something to display */}
          {(insufficient || rating.estimate) && (
            <>
              <div style={{ fontSize: 20, color: insufficient ? C.chalk : C.walnut.mid }}>
                →
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Our estimate</div>
                {insufficient ? (
                  <div style={{ fontSize: 13, fontStyle: "italic", color: C.chalk }}>
                    Not enough data
                  </div>
                ) : (
                  <div style={{ fontSize: 26, fontWeight: 500, color: C.walnut.dark }}>
                    {rating.estimate!.low} – {rating.estimate!.high}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", marginTop: 16 }}>{metaCols}</div>
      </div>

      {/* Why this estimate */}
      {rating.reasoning.length > 0 && (
        <>
          <Divider />
          <section style={{ paddingTop: 20, paddingBottom: 20 }}>
            <SectionHeader>Why this estimate</SectionHeader>
            <div style={{ marginTop: 12 }}>
              <BulletList items={rating.reasoning} />
            </div>
          </section>
        </>
      )}

      {/* Dossier — hidden in insufficient state */}
      {!insufficient && rating.dossier.length > 0 && (
        <>
          <Divider />
          <section style={{ paddingTop: 20, paddingBottom: 20 }}>
            <SectionHeader>Dossier</SectionHeader>
            <div style={{ marginTop: 12 }}>
              <BulletList items={rating.dossier} />
            </div>
          </section>
        </>
      )}

      <Divider />

      {/* Footer */}
      <div style={{ paddingTop: 16 }}>
        <button
          className="btn-search-again"
          onClick={onReset}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.parchment)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "7px 16px",
            borderRadius: 8,
            border: BORDER.card,
            background: "transparent",
            color: C.walnut.btn,
            cursor: "pointer",
          }}
        >
          Search again
        </button>
      </div>
    </div>
  );
}
