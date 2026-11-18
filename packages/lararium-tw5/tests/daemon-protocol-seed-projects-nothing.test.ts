/**
 * daemon-protocol-seed-projects-nothing — the daemon's born-from-source tiddlers rest in the shadow layer.
 *
 * `seedDaemonProtocol` writes the daemon's UI surfaces and its flow set from source at every boot. A record written
 * as an ordinary tiddler lands in the daemon wiki's working layer, which mirrors under `<projections>/wikis/daemon-<F>/`,
 * so each boot would write a file there over any hand's edit. The seed instead lays its records into TiddlyWiki's shadow
 * layer, as plugins whose own tiddlers rest in the volatile `$:/temp/` slot: no store holds a seeded record, no mirror
 * receives one, and a hand that edits a seeded surface writes an ordinary override the next seed leaves standing.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/bag-roles
 */
import { describe, expect, test } from "vitest";
import { HULLS_FULL, HULLS_TS_ONLY, type RunnableHulls } from "@lararium/mesh";
import { seedDaemonProtocol } from "../src/daemon-protocol-seed.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

type Fields = Record<string, string | string[]>;

/** Every ordinary write and every shadow record the seed lays, captured at the engine's two doors. */
function seeded(hulls: RunnableHulls): { writes: Fields[]; shadows: { plugin: string; records: Fields[] }[] } {
  const writes: Fields[] = [];
  const shadows: { plugin: string; records: Fields[] }[] = [];
  const engine = {
    setTiddler: (fields: Fields) => { writes.push({ ...fields }); },
    setShadowTiddlers: (plugin: string, records: readonly Fields[]) => { shadows.push({ plugin, records: records.map((r) => ({ ...r })) }); },
  };
  seedDaemonProtocol(engine as unknown as TW5Engine, hulls);
  return { writes, shadows };
}

const titlesOf = (s: ReturnType<typeof seeded>): string[] => s.shadows.flatMap((p) => p.records.map((r) => String(r["title"])));

describe("the daemon protocol seed rests in the shadow layer", () => {
  test("control: the seed lays the daemon UI surfaces and every flow a full vessel enacts", () => {
    const titles = titlesOf(seeded(HULLS_FULL));
    expect(titles.filter((t) => t.startsWith("$:/lares/ui/")).length).toBe(12);
    expect(titles.filter((t) => t.includes("/daemon/flows/")).length).toBe(3);
  });

  test.each([["a full node vessel", HULLS_FULL], ["a ts-only vessel", HULLS_TS_ONLY]] as const)(
    "%s: no seeded record reaches a store; each plugin rests in the volatile slot", (_label, hulls) => {
      const s = seeded(hulls);
      expect(titlesOf(s).length).toBeGreaterThan(0);
      expect(s.writes.map((w) => w["title"]), "an ordinary write lands in the mirrored working layer").toEqual([]);
      for (const { plugin } of s.shadows) expect(plugin.startsWith("$:/temp/")).toBe(true);
    },
  );

  test("no seeded record carries a residency field", () => {
    for (const r of seeded(HULLS_FULL).shadows.flatMap((p) => p.records)) expect(r).not.toHaveProperty("disk-projection");
  });

  test("the seed moves no other field a reader keys on", () => {
    const flows = seeded(HULLS_FULL).shadows.flatMap((p) => p.records).filter((r) => r["flow-seed"] === "true");
    expect(flows.map((r) => r["petname"]).sort()).toEqual(["couple", "crystal", "rhythm"]);
    for (const f of flows) expect(f["capStack"]).toMatch(/^\S+:\S+( \S+:\S+)*$/);
  });
});

describe.skipIf(wikiSkip)(`the seed in a live wiki${skipNote}`, () => {
  test("each seeded surface reads as a shadow, no store tiddler holds it, and a hand's override survives a re-seed", async () => {
    const engine = await bootTestWiki();
    seedDaemonProtocol(engine, HULLS_FULL);
    const wrapper = "$:/lares/ui/surface-switch";
    expect(engine.wiki.isShadowTiddler(wrapper)).toBe(true);
    expect(engine.wiki.tiddlerExists(wrapper), "a store tiddler would project").toBe(false);
    expect(engine.wiki.getTiddlerText(wrapper)?.length ?? 0).toBeGreaterThan(0);
    engine.setTiddler({ title: wrapper, text: "a hand's edit" });
    seedDaemonProtocol(engine, HULLS_FULL);
    expect(engine.wiki.getTiddlerText(wrapper)).toBe("a hand's edit");
  });
});
