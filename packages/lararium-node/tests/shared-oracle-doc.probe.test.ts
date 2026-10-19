/**
 * shared-oracle-doc — CANARY: does a pointer written by vessel B reach vessel A?
 * Both named outcomes: A's @oracle sees B's lares URL after B reconciles (one shared LWW pointer),
 * or A keeps its own URL (the deterministic doc id does not produce shared state).
 *
 * MEASURED 2026-10-18: the pointer CROSSES. Two vessels that each minted their own lares doc converge, once synced, on
 * ONE `LARES_DOC_URI` value, so one vessel's own lares pointer names the other's doc; B's reconcile then lands on A.
 * The @oracle doc stands as one document every vessel writes (W21, W26's owed no-writer rule), and a wiki island
 * that followed its lares canon off it would mount a sibling's doc (`recipe-watch-own-canon.test.ts`). A floor that
 * stops sharing a writable id flips this canary.
 */
import { describe, test, expect, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_DOC_URI, materializeGenesisIsland, tiddlerText } from "@lararium/mesh";
import { mintLaresIfAbsent, readGenesisSeed, reconcileWellKnownTiddlers } from "../src/genesis-artifact.js";

const genesisDir = join(repoRoot, "genesis");
function repo(network: MessageChannelNetworkAdapter[] = []) {
  return new Repo({ network, sharePolicy: async () => true });
}
async function vessel(label: string, r: Repo) {
  const seed = readGenesisSeed(genesisDir);
  if (!seed) throw new Error(`tracked genesis seed missing under ${genesisDir}`);
  const oracle = await materializeGenesisIsland(r, seed, label);
  return { oracle, url: mintLaresIfAbsent(r, oracle) };
}

describe("shared @oracle document pointer canary", () => {
  test("★ MEASURE — B's lares pointer reaches A through the deterministic shared oracle doc ★", async () => {
    const { port1, port2 } = new MessageChannel();
    const aRepo = repo([new MessageChannelNetworkAdapter(port1)]);
    const bRepo = repo([new MessageChannelNetworkAdapter(port2)]);
    try {
      const a = await vessel("probe-A", aRepo);
      const b = await vessel("probe-B", bRepo);
      expect(a.url).not.toBe(b.url);
      const aReading = () => tiddlerText(a.oracle.doc()?.tiddlers?.[LARES_DOC_URI]);
      const bReading = () => tiddlerText(b.oracle.doc()?.tiddlers?.[LARES_DOC_URI]);
      // The two oracles converge on ONE pointer: each vessel minted its own lares doc, and one of the two urls now
      // names the lares bag on both.
      await vi.waitFor(() => expect(aReading()).toBe(bReading()));
      expect([a.url, b.url]).toContain(aReading());
      console.error(`shared-oracle MEASURE: A minted ${a.url.slice(0, 22)}…, B minted ${b.url.slice(0, 22)}…; both now read ${aReading()?.slice(0, 22)}…`);
      reconcileWellKnownTiddlers(b.oracle, b.url);
      await vi.waitFor(() => expect(aReading()).toBe(b.url));
      expect(bReading()).toBe(b.url);
    } finally {
      port1.close(); port2.close();
      await aRepo.shutdown(); await bRepo.shutdown();
    }
  }, 15_000);

  test("control: disconnected vessels do not observe B's reconcile", async () => {
    const aRepo = repo(); const bRepo = repo();
    try {
      const a = await vessel("control-A", aRepo);
      const b = await vessel("control-B", bRepo);
      expect(a.url).not.toBe(b.url);
      reconcileWellKnownTiddlers(b.oracle, b.url);
      await vi.waitFor(() => expect(tiddlerText(b.oracle.doc()?.tiddlers?.[LARES_DOC_URI])).toBe(b.url));
      expect(tiddlerText(a.oracle.doc()?.tiddlers?.[LARES_DOC_URI])).toBe(a.url);
    } finally {
      await aRepo.shutdown(); await bRepo.shutdown();
    }
  });
});
