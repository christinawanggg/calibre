import { IconTrendingUp, IconMinus, IconTrendingDown } from "@tabler/icons-react";
import type { ComponentType } from "react";
import type { Rating } from "../types";

export const C = {
  walnut:  { dark: "#4A2E1A", mid: "#8C5E3C", light: "#EDE0D0", btn: "#6B4020" },
  grove:   { dark: "#2A4A32", light: "#D4E8D8", border: "#A8C8B0" },
  oxblood: { dark: "#7A2424", light: "#F5E4E4", border: "#D4AAAA" },
  parchment: "#F6F2EC",
  stone:     "#DDD7CE",
  linen:     "#E8DDD0",
  ink:       "#1C1208",
  clay:      "#5A5048",
  dust:      "#9A8E80",
  chalk:     "#C4B8A8",
  white:     "#FFFFFF",
} as const;

type Directional = NonNullable<Rating["directional"]>;
type Confidence  = Rating["confidence"];
type Trajectory  = NonNullable<Rating["trajectory"]>;

export const VERDICT_CONFIG: Record<Directional, { label: string; color: string }> = {
  underrated:  { label: "Underrated",  color: C.grove.dark  },
  about_right: { label: "About right", color: C.walnut.dark },
  overrated:   { label: "Overrated",   color: C.oxblood.dark },
};

export const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string }> = {
  HIGH:         { label: "High",         color: C.grove.dark  },
  MEDIUM:       { label: "Medium",       color: C.walnut.btn  },
  LOW:          { label: "Low",          color: C.dust        },
  INSUFFICIENT: { label: "Insufficient", color: C.chalk       },
};

type IconComponent = ComponentType<{ size?: number; color?: string; stroke?: number }>;

export const TRAJECTORY_CONFIG: Record<
  Trajectory,
  { label: string; color: string; Icon: IconComponent }
> = {
  improving: { label: "Improving", color: C.grove.dark,   Icon: IconTrendingUp   },
  stable:    { label: "Stable",    color: C.dust,          Icon: IconMinus        },
  declining: { label: "Declining", color: C.oxblood.dark, Icon: IconTrendingDown },
};
