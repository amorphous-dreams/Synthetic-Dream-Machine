/**
 * What the affordance witnesses share: the baked pack (the live table every one of them reads), the CLI door a pack route
 * names, and a shell-word splitter for the runnable lines a carrier's examples and cures render.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws · lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { affordancePack, type AffordancePack } from "@lararium/tw5/affordance-pack";

export const pack = (): AffordancePack => affordancePack();

/** The address the oracle cast flipped first at: every affordance law seeds on it, so an empty pack reads red, never vacuous. */
export const SEED_ADDRESS = "lar:///oracle.cast.throws";

/** Wave 2's carriers: the doors that held no legacy help entry (`act` · `ingest` · `export` · `import` · `shore` · `bag` · `flow`). */
export const WAVE_2 = [
  "carriage.record.adds", "carriage.bag.copies", "carriage.bag.moves", "carriage.bag.clears", "carriage.bag.drops", "carriage.bag.loads",
  "carriage.bag.creates", "carriage.bundle.repacks", "carriage.draft.pulls", "carriage.capture.ingests", "carriage.bundle.exports",
  "carriage.bundle.imports", "carriage.disk.reads", "carriage.record.wins", "carriage.disk.wins", "carriage.disk.merges", "carriage.draft.reads",
  "carriage.disk.restores", "carriage.disk.removes", "carriage.disk.settles", "face.hand.lifts", "carriage.disk.flushes", "carriage.disk.logs",
  "carriage.bag.reads", "carriage.bag.declares", "carriage.bag.homes", "carriage.bag.registers", "carriage.bag.cools", "carriage.bag.compacts",
  "carriage.bag.tends", "realm.bag.shares", "sense.record.flows",
] as const;

/** Every address a canon carrier holds today, by hand: a pack that lacks one reads red, never vacuous. Wave 1a added the calendar and the law; wave 2 the seven unhelped doors. */
export const SEED_ADDRESSES = [
  SEED_ADDRESS, "lar:///oracle.calendar.dates", "lar:///engine.law.indexes", "lar:///engine.law.pins", "lar:///engine.law.unpins",
  ...WAVE_2.map((a) => `lar:///${a}`),
] as const;

/** The cure every pack-shaped red names. */
export const REBAKE = "re-bake: pnpm --filter @lararium/tw5 build, then commit packages/lararium-tw5/affordance-pack.json";

/** Every cli route: its spelling under `lares` (`oracle cast`), its door and verb path, and its address. */
export const cliRoutes = (p: AffordancePack = pack()): Array<{ spelling: string; door: string; path: string[]; address: string }> =>
  Object.entries(p.routes["cli"] ?? {}).map(([spelling, address]) => {
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
