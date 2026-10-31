/**
 * kahu-wire-reach-live — KAHU REACH AT THE WIRE READS THE CURRENT ADMISSION, never the canon the boot held (road `P26`;
 * Sol's blocker on the batch head, 2026-10-31).
 *
 * The wire consult checked only that a same-operator session wore the face whose admission stood the canon AT BOOT, and the
 * same-face bridge named the canon from the same boot snapshot, ahead of the realm gate. After a counted Kahu REMOVAL of
 * that face's group (kahu.mem #/cabal-admission: "a removal therefore closes the access path for every reader that
 * consults it"), a same-face session kept two-way access to the live canon until the hearth rebooted, so the replica set
 * did not close over Kahu hands.
 *
 *   P1  RED: `kahuHandAtWire` holds no reach while the live standing reads removed, whatever the boot held.
 *   P2  (folded into the one guard, kahu-canon-guard A1/A2: the bridge no longer gates; the guard ahead of it does.)
 *   W1  CONTROL (on a real founding): the live standing reads the founding's admission.
 *   W2  RED: after a counted removal of the group, the live standing reads removed and says so to its listener.
 *   W3  CONTROL: a re-admission stands the reading again.
 * W1–W3 load the watch by name, so on the parent they read red at the missing export.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PERSONA_GROUP_ID_TIDDLER, deterministicDocUrl } from "@lararium/mesh";
import * as kahuRealm from "../src/kahu-realm.js";
import { runCabalAct } from "../src/commands/nexus-cabal.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });
const group = "0x" + "ab".repeat(32);
const canon = { lares: deterministicDocUrl("live-lares") as never, lararium: deterministicDocUrl("live-lararium") as never };
const sameOp = { class: "same-operator", face: { personaGroup: group } };

type Watch = { held(): boolean; refresh(): void; close(): void };
type WatchFn = (opts: { repo: unknown; sealHome: string; vesselKey: string; personaGroupId: string | null; onChange?: (held: boolean) => void }) => Promise<Watch>;
const live = kahuRealm as unknown as { watchKahuStanding?: WatchFn };

describe("Kahu reach at the wire reads the live standing", () => {
  test("P1 — no reach while the live standing reads removed, whatever the boot held", () => {
    const hand = (kahuStanding: boolean) =>
      kahuRealm.kahuHandAtWire({ session: sameOp, custodyGroup: group, faceProven: true, canon, kahuStanding } as Parameters<typeof kahuRealm.kahuHandAtWire>[0]);
    expect(hand(true)).toBe(true);
    expect(hand(false)).toBe(false);
  });

  const r = mkdtempSync(join(tmpdir(), "lar-kahu-live-"));
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  afterAll(() => { rmSync(r, { recursive: true, force: true }); });
  const groupPin = (): string => (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> }).tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text;

  test("W1–W3 — the live standing follows the board: founded, removed, re-admitted", async () => {
    expect(typeof live.watchKahuStanding, "watchKahuStanding stands").toBe("function");
    await withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") }));
    await withLarRoot(r, async () => {
      const sealHome = larSealHome();
      const vesselKey = await loadVesselVerifyingKey();
      await ownedStore(larDataDir(), async (repo) => {
        const heard: boolean[] = [];
        const watch = await live.watchKahuStanding!({ repo, sealHome, vesselKey, personaGroupId: groupPin(), onChange: (held) => heard.push(held) });
        try {
          expect(watch.held(), "W1: the founding's admission").toBe(true);
          const bare = groupPin().replace(/^0x/, "");
          await runCabalAct({ repo, sealHome, group: bare, action: "remove" });
          watch.refresh();
          expect(watch.held(), "W2: a counted removal").toBe(false);
          expect(heard).toContain(false);
          await runCabalAct({ repo, sealHome, group: bare, action: "admit" });
          watch.refresh();
          expect(watch.held(), "W3: a re-admission").toBe(true);
        } finally { watch.close(); }
      });
    });
  });
});
