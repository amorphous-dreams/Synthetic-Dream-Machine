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
    const write = vi.spyOn(Socket.prototype, "write");
    const front = serveUdsFront({ claim });
    front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo,
      sessions: { open: async ({ faceRef }) => faceRef === "refuse"
        ? { ok: false, refusal: "face-unverified" }
        : { ok: true, supply: { face, profile: "seat", presenter: "verified-a" } } },
      placeVerb: (o) => {
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
      await two.close();
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
