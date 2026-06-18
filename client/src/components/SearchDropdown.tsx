import { useState, useRef } from "react";
import { searchPlayers } from "../api";
import type { Candidate } from "../types";

function photoUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const key     = raw.startsWith("/") ? raw.slice(1) : raw;
  const payload = JSON.stringify({ bucket: "redpadel-production-ui-files", key, edits: { resize: { width: 128, height: 128, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } } } });
  return `https://d122z1d8jk9gd0.cloudfront.net/${btoa(payload)}`;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

interface Props {
  onSelect: (candidate: Candidate) => void;
  disabled: boolean;
}

export function SearchDropdown({ onSelect, disabled }: Props) {
  const [value, setValue]         = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function doSearch(q: string) {
    setLoading(true);
    setOpen(true);
    try {
      setCandidates(await searchPlayers(q));
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(val: string) {
    setValue(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setOpen(false);
      setCandidates([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 350);
  }

  function handleSelect(c: Candidate) {
    setValue(c.name);
    setOpen(false);
    onSelect(c);
  }

  const showDropdown = open && !disabled;

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Search player name..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => candidates.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 16,
          border: "1px solid #333",
          borderRadius: showDropdown ? "6px 6px 0 0" : 6,
          background: "#1a1a1a",
          color: "#fff",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {showDropdown && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#1a1a1a",
          border: "1px solid #333",
          borderTop: "1px solid #222",
          borderRadius: "0 0 6px 6px",
          zIndex: 50,
          overflow: "hidden",
        }}>
          {loading && (
            <div style={{ padding: "12px 14px", color: "#555", fontSize: 13 }}>
              Searching...
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div style={{ padding: "12px 14px", color: "#555", fontSize: 13 }}>
              No players found
            </div>
          )}

          {!loading && candidates.map((c) => {
            const url = photoUrl(c.photo);
            const sub = [
              c.gender,
              c.wprVerified != null
                ? `WPR ${c.wprVerified.toFixed(2)}`
                : c.wprSocial != null
                  ? `WPR ~${c.wprSocial.toFixed(2)}`
                  : null,
            ].filter(Boolean).join(" · ");

            return (
              <button
                key={c.id}
                onMouseDown={() => handleSelect(c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid #222",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#242424")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Avatar */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "#2a2a2a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#888",
                }}>
                  {url
                    ? <img src={url} alt={c.name} width={36} height={36} style={{ objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : initials(c.name)
                  }
                </div>

                {/* Text */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                  {sub && <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{sub}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
