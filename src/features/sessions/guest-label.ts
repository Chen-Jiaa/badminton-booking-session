const MAX_NAME = 10;

/** "Low's guest": the sponsor's name plus "'s guest", cut to the first word when it's long. */
export function guestLabel(sponsorName?: string | null) {
  const full = sponsorName?.trim().replace(/\s+/g, " ");
  if (!full) return "Guest";
  // The "'s" counts towards the limit
  const name = `${full}'s`.length <= MAX_NAME ? full : full.split(" ")[0];
  return `${name}'s guest`;
}
