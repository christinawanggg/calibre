export function photoUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const key = raw.startsWith("/") ? raw.slice(1) : raw;
  const payload = JSON.stringify({
    bucket: "redpadel-production-ui-files",
    key,
    edits: { resize: { width: 128, height: 128, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } } },
  });
  return `https://d122z1d8jk9gd0.cloudfront.net/${btoa(payload)}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
