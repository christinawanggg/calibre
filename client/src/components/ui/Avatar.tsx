import { useState } from "react";
import { photoUrl, initials } from "../../lib/utils";
import { C } from "../../lib/tokens";

interface AvatarProps {
  name: string;
  photo: string | null;
  size?: number;
  bg?: string;
  fg?: string;
  fontSize?: number;
}

export function Avatar({
  name,
  photo,
  size = 42,
  bg = C.walnut.light,
  fg = C.walnut.dark,
  fontSize = 13,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = !failed ? photoUrl(photo) : null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 500,
        color: fg,
      }}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          style={{ objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
