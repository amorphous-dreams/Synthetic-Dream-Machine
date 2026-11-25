/**
 * ingest-seat-unattended — A STAND-OFF SETTLES BY A PERSON, ON THE INGEST LEG TOO. A wave's `unattended` flag comes from its
 * caller, so a seat's `lares ingest --apply` (or a spirit's) would adopt a file that holds no base over records that say
 * something else, settling a stand-off with no person. Inside the vessel a wave whose asker reads `seat` rides unattended
 * whatever it claims: the gate answers `conflict` and lands nothing. (The socket stamps an unread peer's wave unattended before
 * it places, `uds-seat-proposes-never-lifts`; a wave with no asker here is the vessel's own.)
 *
 *   U1  RED: a seat's no-base wave over differing records stands off (`conflict`) and the records stay
 *   U2  a wave claims no attended reading (`unattended: false` reads malformed): only the asker decides
 *   U3  CONTROL: the operator's hand (`cli`) adopts the file, as `lares ingest` always named
 */
import { describe, test, expect } from "vitest";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { emptyLarDoc } from "@lararium/mesh/base-doc";
import { type CapabilityAccess, type CapabilityVerifyResult } from "@lararium/mesh/capability";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { carrierHash } from "@lararium/mesh/crypto";
import { Repo } from "./wiki-shore-rig.js";
import { registerActionReactors } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const WORKING = "lar:///ha.ka.ba/wikis/probe/working";
const URI = "lar:///t.seat.stands-off/one";
const carrier = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.seat.stands-off/one\"\n```\n\n" +
  `! One\n\n${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

async function rig() {
  const repo = new Repo({ network: [] });
  const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const wave = async (text: string, asker: "cli" | "seat" | null, extra: Record<string, unknown> = {}) => {
    const args = { "source-uri": "file:///scratch/projections/wikis/probe", "to-bag": WORKING, "change-id": `chg-${Math.random()}`, carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".mem" }], ...extra };
    const ctx: VerbContext = { daemon: composite, cap: allowCap, ...(asker !== null ? { asker } : {}),
      invocation: { requestId: "req", title: "lar:///lararium.local.vm/verbs/req", action: "INGEST", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-11-23T00:00:00Z" } as Verb } as VerbContext;
    const out = await table.get("INGEST")!(args, ctx) as Record<string, unknown>;
    return (out["carriers"] as Array<Record<string, unknown>>)[0]!["decision"];
  };
  await wave(carrier("the records' words"), "cli");
  return { composite, wave };
}

describe("a seat's wave never settles a stand-off", () => {
  test("U1 RED — a seat's no-base wave over differing records stands off, and the records stay", async () => {
    const r = await rig();
    expect(await r.wave(carrier("a file's other words"), "seat")).toBe("conflict");
    expect(String((await r.composite.get(URI))?.tiddler["text"])).toContain("the records' words");
  });

  test("U2 — a wave can claim no attended reading at all: `unattended: false` reads malformed, so only the asker decides", async () => {
    const r = await rig();
    await expect(r.wave(carrier("a file's other words"), "cli", { unattended: false })).rejects.toThrow(/malformed args/);
  });

  test("U3 CONTROL — the operator's hand adopts the file", async () => {
    const r = await rig();
    expect(await r.wave(carrier("a file's other words"), "cli")).toBe("ingest");
    expect(String((await r.composite.get(URI))?.tiddler["text"])).toContain("a file's other words");
  });
});
