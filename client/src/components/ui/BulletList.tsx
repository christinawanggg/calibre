import { C } from "../../lib/tokens";

interface BulletListProps {
  items: string[];
}

export function BulletList({ items }: BulletListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              flexShrink: 0,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: C.chalk,
              marginTop: 5,
            }}
          />
          <span style={{ fontSize: 13, color: C.clay, lineHeight: 1.55 }}>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}
