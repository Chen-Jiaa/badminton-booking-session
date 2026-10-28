// The badge list: names, wording and colours. Client-safe. Every badge is a lifetime
// counter that only goes up (no tiers, no finish line). The maths is in `logic.ts`.

export type BadgeId =
  | "regular"
  | "never-missed"
  | "streak"
  | "early-bird"
  | "friend"
  | "reliable"
  | "founder"
  | "champion"
  | "podium"
  | "hot-hand"
  | "duo"
  | "rally";

export type BadgeGroup = "Showing up" | "Winning";

export interface BadgeDef {
  id: BadgeId;
  name: string;
  group: BadgeGroup;
  /** One line: what it's for and what adds to the number */
  blurb: string;
  /** What the number counts, shown next to it: "sessions played" */
  unit: string;
  /** HSL hue of the medal, so each badge is recognisable at a glance */
  hue: number;
  /** The badge is earned once its number reaches this (below it, it stays locked) */
  min: number;
  /** One-off badge: earned or not, no number */
  oneOff?: boolean;
  /** Not shown at all (not even locked) to someone who doesn't hold it */
  hiddenUntilEarned?: boolean;
}

/** The app launched on 19 Oct 2026; members who joined within a month are founders. */
export const FOUNDING_CUTOFF = new Date("2026-11-19T00:00:00+08:00");

export const BADGES: BadgeDef[] = [
  {
    id: "regular",
    name: "Regular",
    group: "Showing up",
    blurb: "You keep turning up. Every session you play adds one.",
    unit: "sessions played",
    hue: 270,
    min: 1,
  },
  {
    id: "never-missed",
    name: "Never Missed",
    group: "Showing up",
    blurb: "Play every session in a month. Each perfect month adds one.",
    unit: "perfect months",
    hue: 215,
    min: 1,
  },
  {
    id: "streak",
    name: "Streak Keeper",
    group: "Showing up",
    blurb: "Play at least once a week, week after week. Shows your longest run.",
    unit: "weeks, longest streak",
    hue: 24,
    min: 2,
  },
  {
    id: "early-bird",
    name: "Early Bird",
    group: "Showing up",
    blurb: "RSVP within an hour of a session being posted.",
    unit: "early RSVPs",
    hue: 40,
    min: 1,
  },
  {
    id: "friend",
    name: "Friend Bringer",
    group: "Showing up",
    blurb: "Bring a friend along as a guest.",
    unit: "guests brought",
    hue: 150,
    min: 1,
  },
  {
    id: "reliable",
    name: "Reliable",
    group: "Showing up",
    blurb: "Months you played without a single late cancellation.",
    unit: "clean months",
    hue: 195,
    min: 1,
  },
  {
    id: "founder",
    name: "Founding Member",
    group: "Showing up",
    blurb: "You joined in the app's first month.",
    unit: "",
    hue: 130,
    min: 1,
    oneOff: true,
    hiddenUntilEarned: true,
  },
  {
    id: "champion",
    name: "Monthly Champion",
    group: "Winning",
    blurb: "Finish #1 on the monthly leaderboard.",
    unit: "months won",
    hue: 46,
    min: 1,
  },
  {
    id: "podium",
    name: "Podium",
    group: "Winning",
    blurb: "Finish in the top 3 of the monthly leaderboard.",
    unit: "podium months",
    hue: 330,
    min: 1,
  },
  {
    id: "hot-hand",
    name: "Hot Hand",
    group: "Winning",
    blurb: "Win 3 or more matches in a row. Shows your best run.",
    unit: "wins, best run",
    hue: 355,
    min: 3,
  },
  {
    id: "duo",
    name: "Dynamic Duo",
    group: "Winning",
    blurb: "Win 3 or more doubles matches with the same partner. Shows your best pair.",
    unit: "wins with one partner",
    hue: 175,
    min: 3,
  },
  {
    id: "rally",
    name: "Rally Machine",
    group: "Winning",
    blurb: "Every rally point you score in confirmed matches.",
    unit: "points scored",
    hue: 250,
    min: 1,
  },
];

export const BADGE_GROUPS: BadgeGroup[] = ["Showing up", "Winning"];

export const badgeById = (id: BadgeId) => BADGES.find((b) => b.id === id)!;

/** A person's number for one badge, 0 while it's locked. */
export interface BadgeCount {
  id: BadgeId;
  count: number;
}
