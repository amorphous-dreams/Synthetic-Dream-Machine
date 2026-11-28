/**
 * What the affordance witnesses share: the baked pack (the live table every one of them reads), the CLI door a pack route
 * names, and a shell-word splitter for the runnable lines a carrier's examples and cures render.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws · lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { affordancePack, type AffordancePack } from "@lararium/tw5/affordance-pack";

export const pack = (): AffordancePack => affordancePack();

/** The address the oracle cast flipped first at: every affordance law seeds on it, so an empty pack reads red, never vacuous. */
export const SEED_ADDRESS = "lar:///library.oracle.speaks";

/** Wave 2's carriers: the doors that held no legacy help entry (`act` · `ingest` · `export` · `import` · `shore` · `bag` · `flow`). */
export const WAVE_2 = [
  "carriage.record.adds", "carriage.bag.copies", "carriage.bag.moves", "carriage.bag.clears", "carriage.bag.drops", "carriage.bag.loads",
  "carriage.bag.creates", "carriage.bundle.repacks", "carriage.draft.pulls", "carriage.capture.ingests", "carriage.bundle.exports",
  "carriage.bundle.imports", "carriage.disk.reads", "carriage.record.wins", "carriage.disk.wins", "carriage.disk.merges", "carriage.draft.reads",
  "carriage.disk.restores", "carriage.disk.removes", "carriage.disk.settles", "face.hand.lifts", "carriage.disk.flushes", "carriage.disk.logs",
  "carriage.bag.reads", "carriage.bag.declares", "carriage.bag.homes", "carriage.bag.registers", "carriage.bag.cools", "carriage.bag.compacts",
  "carriage.bag.tends", "realm.bag.shares", "sense.record.flows",
] as const;

/** Wave 3a's carriers that skin a terminal door: `kahua` · `trust` · `kapae` · `events` · `hooks` · `mcp`. */
export const WAVE_3A = [
  "face.key.mints", "face.draft.proposes", "face.draft.stages", "face.hand.withdraws", "face.carry.restands", "face.draft.reads",
  "carriage.draft.lifts", "realm.offer.reads", "realm.offer.prepares", "realm.offer.commits", "realm.offer.drops", "realm.offer.orphans",
  "realm.kapae.raises", "realm.kapae.lowers", "realm.kapae.flags", "engine.status.follows", "sense.capture.pauses", "sense.capture.resumes",
  "sense.capture.reads", "engine.seat.holds",
] as const;

/** Wave 3a's seat-only carriers: the sensorium branch mute and its restore render no cli line. */
export const WAVE_3A_SEAT = ["sense.kapae.mutes", "sense.kapae.restores"] as const;

/**
 * The core verbs' carriers (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts, landing 1; candidate addresses), skinned on the
 * terminal as the call shape since landing 8: `lares get` (by title or by filter), `lares put`, `lares delete`, `lares rename`, and
 * landing 16's `lares watch`.
 */
export const CORE_VERBS = ["engine.record.reads", "engine.record.puts", "engine.record.removes", "engine.record.renames", "engine.filter.pages", "engine.filter.watches"] as const;

/** Every address a canon carrier holds today, by hand: a pack that lacks one reads red, never vacuous. Wave 1a added the calendar and the law; wave 2 the seven unhelped doors; wave 3a the kahua, trust, kapae, events, hooks and mcp doors; the comms course's landing 1 the core verbs. */
export const SEED_ADDRESSES = [
  SEED_ADDRESS, "lar:///oracle.calendar.dates", "lar:///engine.law.indexes", "lar:///engine.law.pins", "lar:///engine.law.unpins",
  ...WAVE_2.map((a) => `lar:///${a}`),
  ...WAVE_3A.map((a) => `lar:///${a}`),
  ...CORE_VERBS.map((a) => `lar:///${a}`),
] as const;

/**
 * The doors a cli route names that the pack gathers no door entry for: each holds `door/part` skins, verbs a carrier skins beside
 * a table the door keeps itself. Such a door counts legacy until every verb holds one.
 */
export const partDoors = (p: AffordancePack = pack()): string[] =>
  [...new Set(cliRoutes(p).map((r) => r.door))].filter((d) => !Object.prototype.hasOwnProperty.call(p.doors, d)).sort();

/** The cure every pack-shaped red names. */
export const REBAKE = "re-bake: pnpm --filter @lararium/tw5 build, then commit packages/lararium-tw5/affordance-pack.json";

/** Every cli route: its spelling under `lares` (`oracle cast`), its door and verb path, and its address. */
export const cliRoutes = (p: AffordancePack = pack()): Array<{ spelling: string; door: string; path: string[]; address: string }> =>
  // THE BARE DOOR (the keyword head) spells `lares` alone: the dispatcher answers it before any door, so it routes no door here.
  Object.entries(p.routes["cli"] ?? {}).filter(([spelling]) => spelling.trim() !== "lares" && spelling.trim() !== "").map(([spelling, address]) => {
    const [door, ...path] = spelling.split(/\s+/);
    return { spelling, door: door!, path, address };
  });

/** A runnable cli line split into words the way a POSIX shell splits it (single and double quotes, no expansion). */
export function shellWords(line: string): string[] {
  const out: string[] = [];
  let word = "", quote: string | null = null, any = false;
  for (const ch of line) {
    if (quote) { if (ch === quote) quote = null; else word += ch; continue; }
    if (ch === "'" || ch === "\"") { quote = ch; any = true; continue; }
    if (/\s/.test(ch)) { if (any || word) out.push(word); word = ""; any = false; continue; }
    word += ch;
  }
  if (any || word) out.push(word);
  return out;
}
