/**
 * The game's content tables (`.plans/content-db.md` step 5): area, journey, journey_group, challenge_category,
 * challenge. Single values and references are columns (references are foreign keys), lists of references are join
 * tables with a position (journey_area, journey_group_member, challenge_area), and `data` keeps only nested config
 * (an area's encounter groups, boss, map shape and shop lists; a challenge's unlock and rules).
 *
 * - `normalizeContent` moves a row's known fields out of `data` into its columns and join rows. Rows arrive with
 *   everything in `data` when the seed inserts them, or when `sync-seeds` overwrites them; it runs on every boot
 *   seed and touches only rows that still have such fields, so existing databases convert themselves.
 * - `loadContent` reads the tables back as the flat rows game-data expects (`AreaData`, `JourneyData`…), which is also
 *   the seed files' shape (`exportRewardSeeds`).
 */
import type { Database } from "./index";

type Row = Record<string, unknown>;
type Tx = Parameters<Parameters<Database["$transaction"]>[0]>[0];

const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const without = (d: Row, keys: string[]) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k)));

/** Fields an area keeps as columns; the rest of its data (encounters, boss, shops…) stays nested. */
const AREA_FIELDS = ["id", "index", "enabled", "name", "subtitle", "tier", "theme", "synthTier", "gearPrice", "notes"];
const JOURNEY_FIELDS = ["id", "sort", "enabled", "name", "subtitle", "areas", "unlockAfter", "unlocks", "notes", "category"];
const GROUP_FIELDS = ["id", "sort", "enabled", "name", "subtitle", "category", "journeys", "notes"];
const CATEGORY_FIELDS = ["id", "sort", "enabled", "name", "description"];
const CHALLENGE_FIELDS = ["id", "sort", "enabled", "name", "subtitle", "category", "route", "notes"];

/** How many rows of each table were converted. */
export type NormalizeCounts = Record<"areas" | "journeys" | "journeyGroups" | "challengeCategories" | "challenges", number>;

/**
 * Move fields still in `data` into columns and join rows (areas first, then what refers to them). A reference to a
 * row that doesn't exist fails that row's conversion (the foreign keys refuse it) and is logged; the rest go on.
 */
export async function normalizeContent(db: Database): Promise<NormalizeCounts> {
  const counts: NormalizeCounts = { areas: 0, journeys: 0, journeyGroups: 0, challengeCategories: 0, challenges: 0 };
  const run = async (what: string, id: string, fn: (tx: Tx) => Promise<unknown>) => {
    try {
      await db.$transaction(fn);
      return true;
    } catch (err) {
      console.error(`Content: couldn't convert ${what} ${id}:`, err instanceof Error ? err.message : err);
      return false;
    }
  };

  for (const r of await db.area.findMany({ select: { id: true, data: true } })) {
    const d = isObj(r.data) ? r.data : {};
    if (!("name" in d)) continue;
    const price = Array.isArray(d.gearPrice) ? (d.gearPrice as number[]) : [0, 0];
    const ok = await run("area", r.id, (tx) =>
      tx.area.update({
        where: { id: r.id },
        data: {
          name: str(d.name),
          subtitle: str(d.subtitle),
          tier: Number(d.tier ?? 0),
          theme: str(d.theme, "grassland"),
          synthTier: Number(d.synthTier ?? 32),
          gearPriceLow: Number(price[0] ?? 0),
          gearPriceHigh: Number(price[1] ?? price[0] ?? 0),
          notes: opt(d.notes),
          data: without(d, AREA_FIELDS) as object,
        },
      }),
    );
    if (ok) counts.areas++;
  }

  for (const r of await db.journey.findMany({ select: { id: true, data: true } })) {
    const d = isObj(r.data) ? r.data : {};
    if (!("name" in d) && !("areas" in d)) continue;
    const ok = await run("journey", r.id, async (tx) => {
      await tx.journeyArea.deleteMany({ where: { journeyId: r.id } });
      await tx.journeyArea.createMany({ data: strs(d.areas).map((areaId, position) => ({ journeyId: r.id, position, areaId })) });
      await tx.journey.update({
        where: { id: r.id },
        data: {
          name: str(d.name),
          subtitle: str(d.subtitle),
          unlockAfterId: opt(d.unlockAfter),
          recruits: strs(d.unlocks),
          notes: opt(d.notes),
          data: without(d, JOURNEY_FIELDS) as object,
        },
      });
    });
    if (ok) counts.journeys++;
  }

  for (const r of await db.journeyGroup.findMany({ select: { id: true, data: true } })) {
    const d = isObj(r.data) ? r.data : {};
    if (!("journeys" in d)) continue;
    const ok = await run("journey grouping", r.id, async (tx) => {
      await tx.journeyGroupMember.deleteMany({ where: { groupId: r.id } });
      await tx.journeyGroupMember.createMany({ data: strs(d.journeys).map((journeyId, position) => ({ groupId: r.id, position, journeyId })) });
      await tx.journeyGroup.update({
        where: { id: r.id },
        data: { name: str(d.name), subtitle: opt(d.subtitle), isChallenge: d.category === "challenge", notes: opt(d.notes), data: without(d, GROUP_FIELDS) as object },
      });
    });
    if (ok) counts.journeyGroups++;
  }

  for (const r of await db.challengeCategory.findMany({ select: { id: true, data: true } })) {
    const d = isObj(r.data) ? r.data : {};
    if (!("name" in d)) continue;
    const ok = await run("challenge category", r.id, (tx) =>
      tx.challengeCategory.update({ where: { id: r.id }, data: { name: str(d.name), description: opt(d.description), data: without(d, CATEGORY_FIELDS) as object } }),
    );
    if (ok) counts.challengeCategories++;
  }

  for (const r of await db.challenge.findMany({ select: { id: true, data: true } })) {
    const d = isObj(r.data) ? r.data : {};
    if (!("route" in d)) continue;
    const route = isObj(d.route) ? d.route : {};
    const kind = str(route.kind, "areas");
    const ok = await run("challenge", r.id, async (tx) => {
      await tx.challengeArea.deleteMany({ where: { challengeId: r.id } });
      if (kind === "areas") await tx.challengeArea.createMany({ data: strs(route.areas).map((areaId, position) => ({ challengeId: r.id, position, areaId })) });
      await tx.challenge.update({
        where: { id: r.id },
        data: {
          name: str(d.name),
          subtitle: str(d.subtitle),
          categoryId: opt(d.category),
          routeKind: kind,
          groupId: kind === "group" ? opt(route.group) : null,
          journeyId: kind === "journey" ? opt(route.journey) : null,
          notes: opt(d.notes),
          data: without(d, CHALLENGE_FIELDS) as object,
        },
      });
    });
    if (ok) counts.challenges++;
  }
  return counts;
}

/** The content tables as flat rows (game-data `AreaData`, `JourneyData`, `JourneyGroupData`, …), in order. */
export async function loadContent(db: Database | Tx) {
  const [areas, journeys, journeyGroups, challengeCategories, challenges] = await Promise.all([
    db.area.findMany({ orderBy: { index: "asc" } }),
    db.journey.findMany({ orderBy: { sort: "asc" }, include: { areas: { orderBy: { position: "asc" } } } }),
    db.journeyGroup.findMany({ orderBy: { sort: "asc" }, include: { members: { orderBy: { position: "asc" } } } }),
    db.challengeCategory.findMany({ orderBy: { sort: "asc" } }),
    db.challenge.findMany({ orderBy: { sort: "asc" }, include: { areas: { orderBy: { position: "asc" } } } }),
  ]);
  const nested = (d: unknown) => (isObj(d) ? d : {});
  const withNotes = (notes: string | null) => (notes ? { notes } : {});
  return {
    areas: areas.map((a) => ({
      ...nested(a.data),
      id: a.id,
      index: a.index,
      enabled: a.enabled,
      name: a.name,
      subtitle: a.subtitle,
      tier: a.tier,
      theme: a.theme,
      synthTier: a.synthTier,
      gearPrice: [a.gearPriceLow, a.gearPriceHigh],
      ...withNotes(a.notes),
    })),
    journeys: journeys.map((j) => ({
      ...nested(j.data),
      id: j.id,
      sort: j.sort,
      enabled: j.enabled,
      name: j.name,
      subtitle: j.subtitle,
      areas: j.areas.map((x) => x.areaId),
      unlockAfter: j.unlockAfterId,
      ...(j.recruits.length ? { unlocks: j.recruits } : {}),
      ...withNotes(j.notes),
    })),
    journeyGroups: journeyGroups.map((g) => ({
      ...nested(g.data),
      id: g.id,
      sort: g.sort,
      enabled: g.enabled,
      name: g.name,
      ...(g.subtitle ? { subtitle: g.subtitle } : {}),
      ...(g.isChallenge ? { category: "challenge" } : {}),
      journeys: g.members.map((m) => m.journeyId),
      ...withNotes(g.notes),
    })),
    challengeCategories: challengeCategories.map((c) => ({
      ...nested(c.data),
      id: c.id,
      sort: c.sort,
      enabled: c.enabled,
      name: c.name,
      ...(c.description ? { description: c.description } : {}),
    })),
    challenges: challenges.map((c) => {
      const d = nested(c.data);
      const route =
        c.routeKind === "group" ? { kind: "group", group: c.groupId ?? "" } : c.routeKind === "journey" ? { kind: "journey", journey: c.journeyId ?? "" } : { kind: "areas", areas: c.areas.map((x) => x.areaId) };
      return { ...d, id: c.id, sort: c.sort, enabled: c.enabled, name: c.name, subtitle: c.subtitle, category: c.categoryId ?? "", route, unlock: isObj(d.unlock) ? d.unlock : {}, ...withNotes(c.notes) };
    }),
  };
}

/** A journey grouping to write (game-data `JourneyGroupData`). */
export interface GroupingInput {
  id: string;
  sort: number;
  enabled: boolean;
  name: string;
  subtitle?: string;
  category?: "challenge";
  journeys: string[];
  notes?: string;
}

/** Write a grouping's row and members (replacing its members). */
export async function writeJourneyGroup(tx: Tx, g: GroupingInput): Promise<void> {
  const row = { sort: g.sort, enabled: g.enabled, name: g.name, subtitle: g.subtitle ?? null, isChallenge: g.category === "challenge", notes: g.notes ?? null, data: {} };
  await tx.journeyGroup.upsert({ where: { id: g.id }, create: { id: g.id, ...row }, update: row });
  await tx.journeyGroupMember.deleteMany({ where: { groupId: g.id } });
  await tx.journeyGroupMember.createMany({ data: g.journeys.map((journeyId, position) => ({ groupId: g.id, position, journeyId })) });
}
