import type { CSSProperties } from "react";
import { C } from "./tokens";

// Uppercase field label above a value — e.g. "WPR OFFICIAL", "VERDICT", "TRAJECTORY"
export const labelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: C.dust,
  marginBottom: 4,
};

export const BORDER = {
  card:    `0.5px solid ${C.stone}`,
  divider: `0.5px solid ${C.linen}`,
} as const;
