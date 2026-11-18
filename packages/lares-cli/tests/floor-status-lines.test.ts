/**
 * floor-status-lines -- `lares vessel floor status` prints both truths for every place: the founding record beside the
 * seed (offered) and the floor pin, ratchet by ratchet (D1, shore recommendation 8). A place in no Nexus charter prints
 * that part and names the Nexus refusal on its own line; the read still answers.
 */
import { describe, expect, test } from "vitest";
import { floorStatusLines } from "../src/commands/floor.js";

const same = (r: string) => ({ ratchet: r, record: "x", other: "x", reading: "same" });
const record = { engine: "bafkreiengine000000000001", grammar: "bafkreigrammar00000000002", plugins: "bafkreiplugins00000000003", floor: "f".repeat(64) };

describe("the floor status lines", () => {
  test("RED: a charterless place prints the founding record, the seed (offered), the floor pin's absence and the Nexus refusal by name", () => {
    const lines = floorStatusLines({
      genesis: {
        record,
        seed: { cid: "c".repeat(64), ratchets: ["engine", "plugins", "floor"].map(same).concat([{ ratchet: "grammar", record: "a", other: "b", reading: "moved" }]) },
        floorPin: null,
        line: "",
      },
      nexusRefused: { refusal: "floor-no-charter", message: "this vessel stands in no Nexus charter, so it holds no floor pin past genesis" },
    });
    expect(lines[0]).toBe("floor status");
    expect(lines).toContain(`  founding record: engine ${record.engine} · grammar ${record.grammar} · plugins ${record.plugins} · floor ${record.floor}`);
    expect(lines).toContain(`  seed (offered):  ${"c".repeat(64)} — a newer seed waits: engine same · plugins same · floor same · grammar moved; the founding record keeps serving, and lay moves canon, never the founding record`);
    expect(lines).toContain("  floor pin:       none (no Nexus charter; the founding record's genesis floor serves)");
    expect(lines).toContain("  nexus:           refused floor-no-charter — this vessel stands in no Nexus charter, so it holds no floor pin past genesis");
  });

  test("CONTROL: a chartered place prints the pin per ratchet and the Nexus part as before", () => {
    const lines = floorStatusLines({
      nexus: "aid-of-the-nexus", pinned: { kind: "floor-pin", nexus: "aid-of-the-nexus", release: null, manifest: "f".repeat(64) }, pinSource: "genesis",
      board: "absent", newest: null, heads: [], descends: null, fastForward: false, path: [], refused: [],
      genesis: {
        record,
        seed: { cid: "c".repeat(64), ratchets: ["engine", "grammar", "plugins", "floor"].map(same) },
        floorPin: { manifestCid: "f".repeat(64), ratchets: ["engine", "grammar", "plugins", "floor"].map(same) },
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
});
