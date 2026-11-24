/**
 * floor-status-lines -- `lares vessel floor status` prints both truths for every place: the founding record beside the
 * seed (offered) and the floor pin, ratchet by ratchet (D1, shore recommendation 8). A place in no Nexus charter prints
 * that part and names the Nexus refusal on its own line; the read still answers. The status names the floor's drift behind live
 * canon on its own line, by carrier; an unread drift says so, never a silent zero.
 */
import { describe, expect, test } from "vitest";
import type { GenesisRatchet, RatchetDifference } from "@lararium/mesh";
import { floorStatusLines, readFloorStatus, type FloorDoors } from "../src/commands/floor.js";

const same = (r: GenesisRatchet): RatchetDifference => ({ ratchet: r, record: "x", other: "x", reading: "same" });
const record = { engine: "bafkreiengine000000000001", grammar: "bafkreigrammar00000000002", plugins: "bafkreiplugins00000000003", floor: "f".repeat(64) };

describe("the floor status lines", () => {
  test("RED: a charterless place prints the founding record, the seed (offered), the floor pin's absence and the Nexus refusal by name", () => {
    const lines = floorStatusLines({
      genesis: {
        record,
        seed: { cid: "c".repeat(64), ratchets: (["engine", "plugins", "floor"] as const).map(same).concat([{ ratchet: "grammar", record: "a", other: "b", reading: "moved" }]) },
        floorPin: null,
        line: "",
      },
      nexusRefused: { refusal: "floor-no-charter", message: "this vessel stands in no Nexus charter, so it holds no floor pin past genesis" },
    });
    expect(lines[0]).toBe("floor status");
    expect(lines).toContain(`  founding record: engine ${record.engine} · grammar ${record.grammar} · plugins ${record.plugins} · floor ${record.floor}`);
    expect(lines).toContain(`  seed (offered):  ${"c".repeat(64)} — a newer seed waits: engine same · plugins same · the seed's floor same · grammar moved; the founding record keeps serving, and lay moves canon, never the founding record`);
    expect(lines).toContain("  floor pin:       none (no Nexus charter; the founding record's genesis floor serves)");
    expect(lines).toContain("  nexus:           refused floor-no-charter — this vessel stands in no Nexus charter, so it holds no floor pin past genesis");
  });

  test("CONTROL: a chartered place prints the pin per ratchet and the Nexus part as before", () => {
    const lines = floorStatusLines({
      nexus: "aid-of-the-nexus", pinned: { kind: "floor-pin", nexus: "aid-of-the-nexus", release: null, manifest: "f".repeat(64) }, pinSource: "genesis",
      board: "absent", newest: null, heads: [], descends: null, fastForward: false, path: [], refused: [],
      genesis: {
        record,
        seed: { cid: "c".repeat(64), ratchets: (["engine", "grammar", "plugins", "floor"] as const).map(same) },
        floorPin: { manifestCid: "f".repeat(64), ratchets: (["engine", "grammar", "plugins", "floor"] as const).map(same) },
        line: "",
      },
    } as never);
    expect(lines).toContain(`  seed (offered):  ${"c".repeat(64)} — same on every ratchet`);
    expect(lines).toContain(`  floor pin:       ${"f".repeat(64)} — engine same · grammar same · plugins same · floor same`);
    expect(lines).toContain("floor status · nexus aid-of-the-nexus");
    expect(lines.some((l) => l.startsWith("  pinned:  "))).toBe(true);
    expect(lines.some((l) => l.startsWith("  nexus:           refused"))).toBe(false);
  });
});

describe("an unread founding record", () => {
  test("RED: the status prints the founding record unread with its reason, and no ratchet words", () => {
    const lines = floorStatusLines({
      genesis: { record: { engine: null, grammar: null, plugins: null, floor: null }, seed: null, floorPin: null, line: "", unread: "the fold refused a blob row" },
      nexusRefused: { refusal: "floor-no-charter", message: "no charter" },
    });
    expect(lines).toContain("  founding record: unread here (the fold refused a blob row)");
    expect(lines.some((l) => l.startsWith("  seed (offered):"))).toBe(false);
  });

  test("RED: the status names the floor's drift by carrier; CONTROL: an unread drift says so, never a silent zero", () => {
    const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
    const ROSTER = "lar:///ha.ka.ba/lararium/mesh/hearth-roster";
    const PLAN = "lar:///ha.ka.ba/lararium/mesh/founding-runbook";
    const base = {
      genesis: { record, seed: null, floorPin: null, line: "" },
      nexusRefused: { refusal: "floor-no-charter", message: "no charter" },
    };
    const lines = floorStatusLines({
      ...base,
      floorDrift: { manifest: "f".repeat(64), count: 3, carriers: [PLAN, ROSTER, CREST].sort(), slugs: [{ slug: "lararium", missing: [ROSTER, CREST].sort(), older: [PLAN] }, { slug: "lares", missing: [], older: [] }], unread: ["sdm"] },
    });
    expect(lines).toContain("  floor drift:     3 carrier(s) behind live canon · lararium 2 missing, 1 older · lares 0 missing, 0 older · unread sdm");
    expect(lines).toContain(`    missing: ${[ROSTER, CREST].sort().join(", ")}`);
    expect(lines).toContain(`    older:   ${PLAN}`);
    expect(floorStatusLines({ ...base, floorDrift: null, floorDriftWhy: "no catalog names live canon beside this store, so no live canon reads here" }))
      .toContain("  floor drift:     unread (no catalog names live canon beside this store, so no live canon reads here)");
    expect(floorStatusLines(base)).toContain("  floor drift:     unread (the standing vessel answers no drift reading: its build carries none, and a refresh brings it)");
  });
});

describe("the five drifts, each by its own word, and the one card", () => {
  const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
  const driftedStatus = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    genesis: { record, seed: { cid: "c".repeat(64), ratchets: (["engine", "plugins", "grammar"] as const).map(same).concat([{ ratchet: "floor", record: "a", other: "b", reading: "moved" }]) }, floorPin: null, line: "" },
    nexusRefused: { refusal: "floor-no-charter", message: "no charter" },
    floorDrift: { manifest: "f".repeat(64), count: 1, carriers: [CREST], slugs: [{ slug: "lararium", missing: [CREST], older: [] }], unread: [] },
    floorShadow: null, ...over,
  });
  const doorsOver = (status: () => Record<string, unknown>, puts: Array<{ title: string; text: string; fields: Record<string, string> }>): FloorDoors => ({
    status: async () => status(),
    lag: async () => ({ lag: { source: "/co/bags", holdings: [{ new: ["lar:///ha.ka.ba/lares/x"], changed: [] }], lag: 1, benches: [], benchLag: 0 } }),
    vessel: async () => "0xvessel",
    putCard: async (card) => { const again = puts.some((p) => p.text === card.text && p.title === card.title); puts.push({ title: card.title, text: card.text, fields: { ...card.fields } }); return { decision: again ? "noop" : "put" }; },
  });

  test("RED: each drift reads as its own row; the seed's floor never reads as the canon floor, and every row names a runnable next line", async () => {
    const puts: Array<{ title: string; text: string; fields: Record<string, string> }> = [];
    const s = await readFloorStatus({}, doorsOver(() => driftedStatus(), puts));
    expect(s.drifts!.map((r) => r.word)).toEqual(["disk lag", "working ahead", "canon floor drift", "seed offer", "shadow tally"]);
    expect(s.drifts!.find((r) => r.word === "seed offer")).toMatchObject({ state: "drifts", carriers: ["the seed's floor"], next: "lares vessel floor seed" });
    expect(s.drifts!.find((r) => r.word === "canon floor drift")).toMatchObject({ state: "drifts", carriers: [CREST] });
    expect(s.drifts!.find((r) => r.word === "disk lag")).toMatchObject({ state: "drifts", count: 1, next: "lares vessel lay --apply --yes" });
    const text = floorStatusLines(s).join("\n");
    expect(text).not.toMatch(/(?<!seed's )floor moved/);
    expect(text).toContain("the seed's floor moved");
    for (const r of s.drifts!) expect(r.next).toMatch(/^lares /);
  });

  test("RED: --grain narrows to one drift's rows; lag carries disk lag and working ahead", async () => {
    const s = await readFloorStatus({}, doorsOver(() => driftedStatus(), []));
    const canon = floorStatusLines(s, "canon");
    expect(canon.some((l) => l.includes("canon floor drift"))).toBe(true);
    expect(canon.some((l) => l.includes("seed offer"))).toBe(false);
    expect(floorStatusLines(s, "lag").filter((l) => /disk lag|working ahead/.test(l))).toHaveLength(2);
    expect(floorStatusLines(s, "shadow").some((l) => l.includes("shadow tally"))).toBe(true);
  });

  test("RED: the card lands once per (vessel, Nexus): a second read puts the same bytes, a new cause re-arms it, a level reading voids its row", async () => {
    const puts: Array<{ title: string; text: string; fields: Record<string, string> }> = [];
    let status = driftedStatus();
    const doors = doorsOver(() => status, puts);
    const first = await readFloorStatus({}, doors);
    const second = await readFloorStatus({}, doors);
    expect(first.card).toMatchObject({ decision: "put", state: "armed" });
    expect(second.card).toMatchObject({ decision: "noop" });
    expect(puts[0]).toEqual(puts[1]);
    expect(puts[0]!.title).toMatch(/^lar:\/\/\/ha\.ka\.ba\/lares\/floor\/[0-9a-f]{12}$/);
    expect(puts[0]!.text).toContain("seed offer");
    expect(puts[0]!.text).toContain("`lares vessel floor seed`");
    status = driftedStatus({ floorDrift: { manifest: "f".repeat(64), count: 2, carriers: [CREST, `${CREST}-two`], slugs: [], unread: [] } });
    await readFloorStatus({}, doors);
    expect(puts[2]!.fields["floor-cause"]).not.toBe(puts[0]!.fields["floor-cause"]);
    expect(puts[2]!.title).toBe(puts[0]!.title);
    status = driftedStatus({ floorDrift: { manifest: "f".repeat(64), count: 0, carriers: [], slugs: [], unread: [] } });
    await readFloorStatus({}, doors);
    expect(puts[3]!.text).not.toContain("canon floor drift");
  });

  test("CONTROL: a door that refuses the card never fails the read; the rows still print and the card names why it stands unwritten", async () => {
    const doors: FloorDoors = { ...doorsOver(() => driftedStatus(), []), putCard: async () => ({ decision: "unwritten", why: "no daemon answers" }) };
    const s = await readFloorStatus({}, doors);
    expect(s.drifts).toHaveLength(5);
    expect(floorStatusLines(s).join("\n")).toContain("(unwritten: no daemon answers)");
  });
});
