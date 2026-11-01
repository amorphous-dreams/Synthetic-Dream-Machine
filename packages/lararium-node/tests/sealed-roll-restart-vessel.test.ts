/**
 * sealed-roll-restart-vessel — a removal version outlives an island restart on a REAL founded vessel: the vessel's
 * counted raises ride the session reading (its own fold of the face's fleet board), so the holder still counts the
 * successor after the restart and the next seal stays on it.
 *
 * Its own file: the seat-roll seam is one process-wide subscriber list, and the daemon options' verifier carries no
 * dispose, so an island another test stood would take the roll first and end its delivery.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { announceSeatRoll, type IslandSessionProof, type SessionReading } from "@lararium/keyhive";
import type { OutboxKey, RecordSigner } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { faceProofSubjectRef, sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-garden-notes";
const BODY = "the household's private note: SEARCH-ME-plaintext";
// Each island leaves before the next test: a seat roll reaches every subscriber in turn and the first rejection ends
// the delivery, so a seat left standing from an earlier test would keep the roll from this test's own seat.
const teardown: Array<() => unknown> = [];
afterEach(async () => { while (teardown.length) { try { await teardown.pop()!(); } catch { /* best-effort */ } } });

const verbCtx = (presenter: string, local = true) => ({ daemon: {} as never, invocation: { requestId: "r1" } as never, cap: async () => ({ ok: true }), presenter, local }) as never;
type Proof = IslandSessionProof & { readonly asks: Array<{ requestId: string; verb: string } | null> };
/** The session sign door as the vessel's book answers it, over one face's chain: `reading` bends one answer. */
async function proof(bend: (own: Exclude<SessionReading, { refusal: string }>) => SessionReading = (own) => own): Promise<Proof> {
  const c = await chain("sealed-vessel", "nexus-test-one");
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  const own = { signer, subject: faceProofSubjectRef(c.scope), chain: { scope: c.scope, vesselFaceKey: c.sessionCertificate.vesselFaceKey }, counted: [] as readonly string[], unanswered: [] as readonly string[] };
  const asks: Proof["asks"] = [];
  return { asks, signer: async (ask) => { asks.push(ask); return ask === null ? { refusal: "signer-unavailable" } : bend(own); } };
}
/** Boot the real daemon options over one founded island and one scratch storage root; answer its verbs. */
async function stand(st: Awaited<ReturnType<typeof standFoundedIsland>>, root: string, over: { session?: IslandSessionProof; archive?: Uint8Array; archiveOpens?: boolean; boot?: boolean; outboxKey?: OutboxKey; local?: boolean } = {}) {
  const archives: Uint8Array[] = [];
  // The face registers the bag it seals under: a writer stands only over a bag its own face registers.
  const daemonAuth = { ...st.daemonAuth, registerBags: [...st.daemonAuth.registerBags, BAG], ...(over.archive ? { veilArchiveBytes: over.archive } : {}), ...(over.archiveOpens === false ? { archiveOpens: false } : {}), ...(over.outboxKey ? { outboxKey: over.outboxKey } : {}) };
  const opts = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: () => "clear",
    sealedStore: nodeSealedStoreShore(join(root, "daemon")),
    persistArchive: () => {},
    persistVeilArchive: (bytes) => { archives.push(Uint8Array.from(bytes)); },
    ...(over.session ? { sessionProof: over.session } : {}),
  });
  let kh: { dispose?: () => Promise<void> } | null = null;
  if (over.boot !== false) {
    kh = await opts.verifierFactory!(st.ctx) as never;
    teardown.push(() => kh?.dispose?.());
  }
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, st.ctx);
  const run = (verb: string, args: Record<string, unknown>) => registry.get(verb)!(args, verbCtx(`0x${st.daemonAuth.atom.key}`, over.local ?? true)) as Promise<Record<string, unknown>>;
  return { run, archives, dispose: async () => { await kh?.dispose?.(); } };
}
const scratch = (): string => { const dir = mkdtempSync(join(tmpdir(), "sealed-vessel-")); teardown.push(() => rmSync(dir, { recursive: true, force: true })); return dir; };

describe("a removal version outlives an island restart", () => {
  test("THE SUCCESSOR OUTLIVES A RESTART: the vessel's counted raises ride the session reading, so the removal version still counts and the next seal stays on it", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const bag = st.daemonAuth.registerBags[0]!;
    // The vessel counts the raise on its board, and its ledger marks it answered once a subscriber took the roll.
    let unanswered: string[] = [];
    const session = await proof((own) => ({ ...own, counted: ["raise-test-r"], unanswered }) as never);
    const first = await stand(st, root, { session });
    const sealed = await first.run("sealed-seal", { bag, text: BODY });
    unanswered = ["raise-test-r"];
    await expect(announceSeatRoll({ kind: "seat-roll", scope: st.daemonAuth.deviceEdge.personaRootDid, edgeId: "edge-test", raiseCids: ["raise-test-r"], how: "gone" })).rejects.toThrow(/stays owed/);
    const after = await first.run("sealed-seal", { bag, text: "sealed after the roll" });
    expect(after["keyVersion"]).not.toBe(sealed["keyVersion"]);
    unanswered = [];                                               // the next delivery marks it answered
    await first.dispose();
    const second = await stand(st, root, { session, archive: first.archives.at(-1)! });
    const again = await second.run("sealed-seal", { bag, text: "sealed after the restart" });
    expect(again["keyVersion"]).toBe(after["keyVersion"]);
  }, 120_000);
});
