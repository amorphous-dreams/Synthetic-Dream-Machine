import { describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Socket } from "node:net";
import { Repo } from "../../lararium-node/node_modules/@automerge/automerge-repo/dist/index.js";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri,
  type LarDoc } from "@lararium/mesh";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { claimStore } from "@lararium/node";
import { makeUdsSeat, serveUdsFront } from "../../lararium-node/src/uds-channel.js";
import { openLocalSession, SessionRefused } from "../src/session-connector.js";

/** The fixture door's mint: a signer the seat can drop, holding no key. */
const fixtureMint = async () => ({ ok: true as const, signer: { dropped: false, drop() { (this as { dropped: boolean }).dropped = true; } } });

describe("local session connector", () => {
  test("refusal names the vessel; a bound call and later same-face receipt survive a client close", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "session-connector-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const face: SessionFace = { personaGroup: "group-a", proofSubject: "proof-a", admitRef: "admit-a",
      causalRevision: "revision-a", planes: { persona: "persona-a", circles: "circles-a",
        identities: "identities-a", sessions: "sessions-a", intents: "intents-a" } };
    const faceB: SessionFace = { ...face, personaGroup: "group-b", proofSubject: "proof-b", admitRef: "admit-b" };
    const faceC: SessionFace = { ...face, personaGroup: "group-c", proofSubject: "proof-c", admitRef: "admit-c" };
    const placed: Array<{ face?: string; requestedBy: string }> = [];
    const write = vi.spyOn(Socket.prototype, "write");
    const front = serveUdsFront({ claim });
    front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo, switchActs: { write: async () => {} },
      sessions: { anchorNow: async () => ({ kind: "place" as const, aid: "place-fixture" }), open: async ({ faceRef }) => faceRef === "refuse"
        ? { ok: false, refusal: "face-unverified" }
        : { ok: true, supply: { face: faceRef === "b" ? faceB : faceRef === "c" ? faceC : face, ordinal: Math.max(0, "abc".indexOf(faceRef.slice(-1))), profile: "seat", presenter: `verified-${faceRef}`,
          anchor: { kind: "place" as const, aid: "place-fixture" }, mint: faceRef === "c" ? async () => ({ ok: false as const, refusal: "dial-refused" }) : fixtureMint } } },
      placeVerb: (o) => {
        placed.push(o);
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", requestedBy: o.requestedBy,
          ...(o.face !== undefined && { face: o.face }), cause: "worker", batchMode: "best-effort",
          results: { summary: { ok: true, output: { value: 1 } } } });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      } }));
    try {
      await expect(openLocalSession({ faceRef: "refuse", dataDir: dir })).rejects.toMatchObject({
        name: "SessionRefused", refusal: "face-unverified" });
      expect(new SessionRefused("named").refusal).toBe("named");
      const one = await openLocalSession({ faceRef: "a", dataDir: dir });
      expect(await one.call("load", { value: 1 }, { requestId: "call-1" })).toMatchObject({
        kind: "session:result", requestId: "call-1", status: "done" });
      await one.close();
      const two = await openLocalSession({ faceRef: "a", dataDir: dir });
      expect(await two.receipt("call-1")).toMatchObject({ requestId: "call-1", face: "proof-a", state: "done" });
      // THE SWITCH rides the same session: later calls speak under the face it answers, and the old face's receipt reads unknown.
      expect(await two.switch("a")).toEqual({ outcome: "unchanged", faceRef: "proof-a", generation: 0 });
      expect(await two.switch("b")).toEqual({ outcome: "switched", faceRef: "proof-b", generation: 1 });
      expect(two.faceRef).toBe("proof-b");
      expect(await two.call("load", { value: 2 }, { requestId: "call-2" })).toMatchObject({ kind: "session:result", status: "done" });
      expect(placed.at(-1)).toMatchObject({ face: "proof-b", requestedBy: "verified-b" });
      expect(await two.receipt("call-1")).toMatchObject({ requestId: "call-1", state: "unknown" });
      await expect(two.switch("refuse")).rejects.toMatchObject({ name: "SessionRefused", refusal: "face-unverified", closed: false });
      await two.close();
      // A switch the vessel could not commit closes the session: the refusal reads closed, and a later ask refuses here.
      const three = await openLocalSession({ faceRef: "a", dataDir: dir });
      await expect(three.switch("c")).rejects.toMatchObject({ name: "SessionRefused", refusal: "dial-refused", closed: true });
      await expect(three.call("load", {}, { requestId: "after-close" })).rejects.toMatchObject({ name: "SessionRefused", refusal: "session-closed", closed: true });
      const raw = write.mock.calls.map((args) => args[0]).filter((value): value is string =>
        typeof value === "string" && value.includes('"op":"session:'));
      expect(raw.length).toBeGreaterThan(0);
      expect(raw.every((line) => !line.includes('"requestedBy"'))).toBe(true);
    } finally {
      write.mockRestore();
      front.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
