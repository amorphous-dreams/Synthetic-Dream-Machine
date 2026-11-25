/**
 * load-forks-override-base — THE FORK REMEMBERS ITS BASE at the LOAD door (`override-base.ts`). LOAD lands a family in the
 * target bag's OWN store (`writeFamilyIn`), around `CompositeStore.put`'s fork stamp, so a LOAD into a wiki's working layer
 * of a title canon holds forked an override that named no base, and canon's fresher-than-the-copy warning never read.
 *
 *   L1  a LOAD into the working layer over a title canon holds lands naming canon's carrier identity
 *   L2  a later LOAD of the copy, after canon moved, keeps the base it forked from
 *   L3  CONTROL: a working-only title names no base; a LOAD into any other layer stamps nothing
 */
import { describe, test, expect } from "vitest";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { carrierHashOf } from "@lararium/mesh/carrier-form";
import { emptyLarDoc } from "@lararium/mesh/base-doc";
import { overrideBaseOf } from "@lararium/mesh/override-base";
import { type CapabilityAccess, type CapabilityVerifyResult } from "@lararium/mesh/capability";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { carrierHash } from "@lararium/mesh/crypto";
import { Repo } from "./wiki-shore-rig.js";
import { registerActionReactors } from "../src/action-handler.js";
import { VerbTable, type VerbContext } from "../src/verb-dispatcher.js";

const CANON = "lar:///ha.ka.ba/bags/probe";
const WORKING = "lar:///ha.ka.ba/wikis/probe/working";
const DRAFT = "lar:///ha.ka.ba/wikis/probe/draft";
const URI = "lar:///t.load.forks/one";

const carrier = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.load.forks/one\"\n```\n\n" +
  `! One\n\n${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
const ctxOf = (composite: CompositeStore, action: string, args: Record<string, unknown>): VerbContext => ({
  daemon: composite, cap: allowCap,
  invocation: { requestId: `req-${action}`, title: `lar:///lararium.local.vm/verbs/req-${action}`, action, args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-16T00:00:00Z" } as Verb,
});

async function rig() {
  const repo = new Repo({ network: [] });
  const canon = new AutomergeDocStore(repo.create(emptyLarDoc()), CANON);
  const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
  const draft = new AutomergeDocStore(repo.create(emptyLarDoc()), DRAFT);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: canon, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  composite.addLayer({ bagId: DRAFT, store: draft, writable: true, defaultWritable: false });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const ingestCanon = async (text: string) => {
    const args = { "source-uri": "file:///scratch/projections/bags/probe", "to-bag": CANON, "change-id": `chg-${Math.random()}`, carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".mem" }], unattended: true };
    return await table.get("INGEST")!(args, ctxOf(composite, "INGEST", args));
  };
  const load = async (toBag: string, text: string) => {
    const args = { "source-uri": "lar:///t/src", "to-bag": toBag, "change-id": `chg-${Math.random()}`, carriers: [{ title: URI, text }] };
    return await table.get("LOAD")!(args, ctxOf(composite, "LOAD", args)) as Record<string, unknown>;
  };
  return { canon, working, draft, ingestCanon, load };
}

describe("a LOAD into a wiki's working layer forks the override base", () => {
  test("L1 + L2 — the copy names canon's carrier identity, and keeps it after canon moves and the copy loads again", async () => {
    const r = await rig();
    await r.ingestCanon(carrier("canon words then"));
    const forkedFrom = carrierHashOf((await r.canon.get(URI))!.tiddler);
    await r.load(WORKING, carrier("a hand's copy"));
    expect(overrideBaseOf(await r.working.get(URI)), "the LOAD forked a copy over canon that names no base").toBe(forkedFrom);
    // Canon moves under the copy (a promotion, a seed): its root record takes new words.
    const then = (await r.canon.get(URI))!;
    await r.canon.put({ tiddler: { ...then.tiddler, text: `${String(then.tiddler["text"] ?? "")}\n\ncanon moved` }, meta: {} }, { kind: "canon-hydrate", receipt: "t" });
    expect(carrierHashOf((await r.canon.get(URI))!.tiddler)).not.toBe(forkedFrom);
    await r.load(WORKING, carrier("a hand's copy, again"));
    expect(overrideBaseOf(await r.working.get(URI)), "a later LOAD re-forked the copy off the canon standing now").toBe(forkedFrom);
  });

  test("L3 — CONTROL: a working-only title names no base, and a LOAD into the draft layer stamps nothing", async () => {
    const r = await rig();
    await r.load(WORKING, carrier("working alone"));
    expect(overrideBaseOf(await r.working.get(URI))).toBeNull();
    const s = await rig();
    await s.ingestCanon(carrier("canon words"));
    await s.load(DRAFT, carrier("a draft"));
    expect(overrideBaseOf(await s.draft.get(URI))).toBeNull();
  });
});
