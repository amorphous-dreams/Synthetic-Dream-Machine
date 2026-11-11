/**
 * carry-restores-override-base — THE OVERRIDE BASE TRAVELS. A base rides the record's meta envelope and never projects,
 * so an export reads it by title (the override-bases read) and carries it on the working row, and the import's INGEST
 * carrier names it: the wave stamps it on the record it lands in the working layer, so canon's fresher-than-the-copy
 * warning still reads after a round trip.
 *
 *   B1  a working-layer wave whose carrier names an override base lands the copy naming THAT base, never the hash of the
 *       canon standing now
 *   B2  the override-bases read lists each working copy's base by title, a page at a time; it writes nothing
 *   B3  CONTROL: a canon wave carrying an override base stamps nothing; a working carrier naming none lands as it did
 *   B4  a malformed override base refuses the whole action at the parse
 */
import { describe, test, expect } from "vitest";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, overrideBaseOf, parseResidencyAction, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { Repo } from "./wiki-shore-rig.js";
import { registerActionReactors, makeOverrideBasesReactor } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const CANON = "lar:///ha.ka.ba/bags/probe";
const WORKING = "lar:///ha.ka.ba/wikis/probe/working";
const URI = "lar:///t.carry.keeps/one";
const BASE = `sha256:${"ab".repeat(32)}`;

const carrier = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.carry.keeps/one\"\n```\n\n" +
  `! One\n\n${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
const ctxOf = (composite: CompositeStore, action: string, args: Record<string, unknown>): VerbContext => ({
  daemon: composite, cap: allowCap,
  invocation: { requestId: `req-${action}`, title: `lar:///lararium.local.vm/verbs/req-${action}`, action, args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-10T00:00:00Z" } as Verb,
});

async function rig() {
  const repo = new Repo({ network: [] });
  const canon = new AutomergeDocStore(repo.create(emptyLarDoc()), CANON);
  const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: canon, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const wave = async (toBag: string, text: string, extra: Record<string, unknown> = {}) => {
    const args = { "source-uri": "file:///scratch/projections/wikis/probe", "to-bag": toBag, "change-id": `chg-${Math.random()}`, carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".mem", ...extra }], unattended: true };
    return await table.get("INGEST")!(args, ctxOf(composite, "INGEST", args)) as Record<string, unknown>;
  };
  const bases = makeOverrideBasesReactor({ composite });
  const read = async (args: Record<string, unknown> = {}) => bases({ bag: WORKING, ...args }, ctxOf(composite, "override-bases", args)) as Promise<Record<string, unknown>>;
  return { canon, working, composite, wave, read };
}

describe("an import's working carrier restores the override base it carries", () => {
  test("B1 — the copy lands naming the carried base, never the hash of the canon standing now", async () => {
    const r = await rig();
    await r.wave(CANON, carrier("canon words now"));
    const out = await r.wave(WORKING, carrier("a hand's copy"), { overrideBase: BASE });
    expect((out["carriers"] as Array<Record<string, unknown>>)[0]!["decision"]).toBe("ingest");
    expect(overrideBaseOf(await r.working.get(URI))).toBe(BASE);
    expect((await r.composite.get(URI))?.tiddler["text"]).toContain("a hand's copy");
  });

  test("B2 — the override-bases read lists each copy's base by title and writes nothing", async () => {
    const r = await rig();
    await r.wave(CANON, carrier("canon words now"));
    await r.wave(WORKING, carrier("a hand's copy"), { overrideBase: BASE });
    const before = JSON.stringify(await r.working.get(URI));
    const page = await r.read();
    expect(page["ok"]).toBe(true);
    expect((page["bases"] as Array<{ title: string; base: string }>).find((b) => b.title === URI)?.base).toBe(BASE);
    expect(page["count"]).toBe((page["bases"] as unknown[]).length);
    expect(JSON.stringify(await r.working.get(URI))).toBe(before);
    const refused = await (makeOverrideBasesReactor({ composite: r.composite }))({ bag: CANON }, ctxOf(r.composite, "override-bases", { bag: CANON })) as Record<string, unknown>;
    expect(refused["refusal"]).toBe("override-bases-incomplete");
  });

  test("B3 — CONTROL: a canon wave stamps nothing, and a working carrier naming no base lands as it always did", async () => {
    const r = await rig();
    await r.wave(CANON, carrier("canon words now"), { overrideBase: BASE });
    expect(overrideBaseOf(await r.canon.get(URI))).toBeNull();
    await r.wave(WORKING, carrier("a hand's copy"));
    expect(overrideBaseOf(await r.working.get(URI))).not.toBe(BASE);
  });

  test("B4 — a malformed override base refuses the action at the parse", () => {
    const inv = (overrideBase: unknown) => ({ action: "INGEST", requestId: "r", args: { "source-uri": "file:///x", "to-bag": WORKING, "change-id": "c", carriers: [{ uri: URI, text: "x", diskHash: carrierHash("x"), syncedHash: null, overrideBase }] } });
    expect(parseResidencyAction(inv(BASE) as never)).not.toBeNull();
    expect(parseResidencyAction(inv("not-a-hash") as never)).toBeNull();
    expect(parseResidencyAction(inv(42) as never)).toBeNull();
  });
});
