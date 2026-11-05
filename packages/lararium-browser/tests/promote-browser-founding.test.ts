/**
 * promote-browser-founding — a browser that founds its own face ends that founding with the promote board's `plane` act, the
 * same act a node founding signs: the board mints INSIDE the face's founding act, by whichever device founds the face.
 *
 * The browser's FOUND branch (`openBrowserVessel` with no admit and no bootstrap) runs `runFoundingCeremony` under a
 * self-stood binding, and the ceremony lands the genesis log through `landFaceGenesis`, the one path every founding takes.
 * The walk boots the real vessel over a synthetic custody slot and reads the founded log at `bootstrap-kept`, before the
 * genesis island opens: the founding has signed its log by then and nothing after it may add a pin.
 *
 * SECURITY CLASS (signed founding acts). Witness: the founded log pins the face's derived board once, beside the intents
 * plane, under the root that signed the founding (green from its first run: the founding core signs the pin for every
 * device class). Control: the log folds whole (founded, no fork), and the browser's founder atom stands as the face's first
 * admission (the founding device holds the face; no hearth names it).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test, vi } from "vitest";
import {
  heldDocOf, PROMOTE_PLANE, promotePlaneUrl, promoteBoardDocUrl, makeHandLineage, personaActRecordsOfGroup, projectPersonaLog, verifyingKeyFromDid,
  type LarDoc,
} from "@lararium/mesh";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { BootHalted } from "./wire-vessel-rig.js";

const seen = vi.hoisted(() => ({ foundings: [] as Array<{ repo: unknown; result: Record<string, unknown> }> }));
vi.mock("@lararium/keyhive", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/keyhive")>();
  return {
    ...real,
    runFoundingCeremony: async (input: Parameters<typeof real.runFoundingCeremony>[0]) => {
      const result = await real.runFoundingCeremony(input);
      seen.foundings.push({ repo: input.repo, result: { ...result } as Record<string, unknown> });
      return result;
    },
  };
});

describe("a browser founding ends with the promote board's plane act", () => {
  test("WITNESS: the browser's own founding pins the face's derived board once in its signed log; CONTROL: the log folds whole and the browser's atom stands as its first admission", async () => {
    const idbName = `browser-promote-found-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    let read: { pin: string | null; pins: number; founded: boolean; fork: unknown; first: string | null; group: string } | null = null;
    await expect(openBrowserVessel({ idbName, onPhase: (phase: string) => {
      if (phase !== "bootstrap-kept") return;
      const founding = seen.foundings[0];
      if (!founding) throw new Error("the browser boot ran no founding");
      const group = String(founding.result["personaGroupId"]);
      const plane = heldDocOf(founding.repo as never, String(founding.result["personaUrl"])) as LarDoc | undefined;
      const records = personaActRecordsOfGroup(plane ?? ({ tiddlers: {} } as unknown as LarDoc), group);
      // The fold reads the log under the founding root's epoch-0 roster; the boot's face proof (the KEL-backed lineage) runs after this phase.
      const lineage = makeHandLineage([{ epoch: 0, signers: [verifyingKeyFromDid(String(founding.result["signerDid"]))], threshold: 1 }])!;
      const projection = projectPersonaLog(records, { group, lineage, authorize: () => true });
      read = {
        pin: promotePlaneUrl(projection, group),
        pins: records.filter((r) => (r as { body: Record<string, unknown> }).body["act"] === "plane" && (r as { body: Record<string, unknown> }).body["plane"] === PROMOTE_PLANE).length,
        founded: projection.founded, fork: projection.fork, first: projection.admissions[0]?.deviceKey ?? null, group,
      };
      throw new BootHalted();
    } } as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
    expect(seen.foundings).toHaveLength(1);
    expect(read).not.toBeNull();
    const r = read!;
    expect(r.pin).toBe(promoteBoardDocUrl(r.group));
    expect(r.pins).toBe(1);
    expect(r.founded).toBe(true);
    expect(r.fork).toBeNull();
    expect(r.first).toBe((seen.foundings[0]!.result["founderEdge"] as { deviceVerifyingKey: string }).deviceVerifyingKey);
  }, 120_000);
});

describe("a one-device browser fleet lowers a kāpae under the fresh unlock alone (row 7, S2)", () => {
  test("RED: a lower with no ward route refuses `ward-needs-fresh-unlock` and lands nothing; CONTROL: the passphrase typed for the act lowers it, with no second device asked", async () => {
    const { sealBrowserKeystore, lockBrowserCustody } = await import("../src/browser-custody.js");
    const { generateOrLoadBrowserPersonaRoot } = await import("../src/browser-vessel-identity.js");
    const { runWardAct } = await import("../src/ward-core.js");
    const { browserWardSigner, BrowserWardRefused } = await import("../src/browser-ward.js");
    const { promoteBoardDoor, readPromoteBoard, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } = await import("@lararium/mesh");
    const idbName = `lares:lower-${globalThis.crypto.randomUUID()}`, PASS = "one device's route", GROUP = "one-device-face", D = "d".repeat(64);
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
    const root = await generateOrLoadBrowserPersonaRoot(idbName, 0);
    lockBrowserCustody(idbName);
    const atom = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(4)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(4)) };
    const face = { group: GROUP, grant: (k: string) => k === root.verifyingKey, device: (k: string) => k === atom.key };
    const spawn = () => ({
      postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data)); }; },
      terminate() {},
    });
    const acts: unknown[] = [];
    const doorWith = (askWardRoute?: () => Promise<string>) => promoteBoardDoor({
      group: GROUP, face, atom, epoch: () => 0,
      rootSigner: async () => { if (!askWardRoute) throw new BrowserWardRefused("ward-needs-fresh-unlock"); return browserWardSigner(idbName, 0, await askWardRoute(), spawn); },
      board: { records: async () => acts, land: async (a) => { acts.push(a); } },
      projection: () => ({ planes: {} }),
    });
    const hand = { kind: "hand" as const, id: atom.key };
    await doorWith().kapae({ action: "raise", wiki: "daemon", digest: D, who: hand });
    expect(readPromoteBoard(acts, face).kapae("daemon", D)).toBe("held");
    await expect(doorWith().kapae({ action: "lower", wiki: "daemon", digest: D, who: hand })).rejects.toMatchObject({ code: "ward-needs-fresh-unlock" });
    expect(acts).toHaveLength(1);
    await doorWith(async () => PASS).kapae({ action: "lower", wiki: "daemon", digest: D, who: hand });
    expect(readPromoteBoard(acts, face).kapae("daemon", D)).toBe("withdrawn");
  });
});
