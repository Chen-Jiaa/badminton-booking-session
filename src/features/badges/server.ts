import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { sessionMiddleware } from "@/middleware/auth";
import { BADGES, type BadgeCount, type BadgeId } from "./catalog";
import { heldBadges, loadBadgeNumbers } from "./queries";

export interface BadgeHolder {
  id: string;
  name: string;
  image: string | null;
}

export interface MyBadge {
  id: BadgeId;
  /** 0 while locked */
  count: number;
  /** Whole percent of members who hold it */
  earnedBy: number;
  /** A few other members who hold it */
  holders: BadgeHolder[];
}

/** All badges for the signed-in member: their number, how common it is, and who else has it. */
export const fetchMyBadgesFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }): Promise<MyBadge[]> => {
    const me = session?.user.id;
    if (!me) return [];
    const { numbers, earnedBy, members } = await loadBadgeNumbers();
    const mine = numbers.get(me);
    return BADGES.map((b) => ({
      id: b.id,
      count: mine?.[b.id] ?? 0,
      earnedBy: earnedBy[b.id],
      holders: members
        .filter((m) => m.id !== me && (numbers.get(m.id)?.[b.id] ?? 0) > 0)
        .sort((x, y) => numbers.get(y.id)![b.id] - numbers.get(x.id)![b.id])
        .slice(0, 3)
        .map(({ id, name, image }) => ({ id, name, image })),
    }));
  });

export const myBadgesQueryOptions = () =>
  queryOptions({
    queryKey: ["badges", "mine"],
    queryFn: () => fetchMyBadgesFn(),
  });

/** Every member's held badges (rarest first), for the chips on the leaderboard. */
export const fetchBadgeChipsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, BadgeCount[]>> => {
    const { numbers, earnedBy } = await loadBadgeNumbers();
    const result: Record<string, BadgeCount[]> = {};
    for (const [id, n] of numbers) {
      const held = heldBadges(n, earnedBy);
      if (held.length) result[id] = held;
    }
    return result;
  },
);

export const badgeChipsQueryOptions = () =>
  queryOptions({
    queryKey: ["badges", "chips"],
    queryFn: () => fetchBadgeChipsFn(),
    staleTime: 60 * 1000,
  });
