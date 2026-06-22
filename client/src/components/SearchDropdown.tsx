import { useState, useRef } from "react";
import { searchPlayers } from "../api";
import { C } from "../lib/tokens";
import { BORDER } from "../lib/theme";
import { Avatar } from "./ui/Avatar";
import type { Candidate } from "../types";

interface Props {
  onSelect: (candidate: Candidate) => void;
  disabled: boolean;
}

export function SearchDropdown({ onSelect, disabled }: Props) {
  const [value, setValue]           = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
          border: BORDER.card,
          borderRadius: showDropdown ? "6px 6px 0 0" : 6,
          background: C.white,
          color: C.ink,
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: C.white,
            border: BORDER.card,
            borderTop: BORDER.divider,
            borderRadius: "0 0 6px 6px",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {loading && (
            <div style={{ padding: "12px 14px", color: C.chalk, fontSize: 13 }}>
              Searching...
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div style={{ padding: "12px 14px", color: C.chalk, fontSize: 13 }}>
              No players found
            </div>
          )}

          {!loading &&
            candidates.map((c) => {
              const sub = [
                c.gender,
                c.wprVerified != null
                  ? `WPR ${c.wprVerified.toFixed(2)}`
                  : c.wprSocial != null
                  ? `WPR ~${c.wprSocial.toFixed(2)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelect(c)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.parchment)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderTop: BORDER.divider,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Avatar name={c.name} photo={c.photo} size={32} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{c.name}</div>
                    {sub && <div style={{ fontSize: 12, color: C.dust, marginTop: 1 }}>{sub}</div>}
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
