const RATING_TTL_HOURS    = 120; // 5 days
const BACKGROUND_TTL_DAYS = 365;

export function ratingExpiresAt(): Date {
  return new Date(Date.now() + RATING_TTL_HOURS * 3_600_000);
}

export function backgroundExpiresAt(): Date {
  return new Date(Date.now() + BACKGROUND_TTL_DAYS * 86_400_000);
}
