/**
 * ward-worker — one browser ward act (seat-harness#/the-ward): the face root signs inside a per-act worker, fresh from the
 * passphrase typed for the act, and the page's own unlock never takes part. The pure core runs in-process here through a spawn
 * that wires a MessageChannel to it, the way the worker entry does. Every red pairs with a CONTROL.
 */
import { describe, expect, test } from "vitest";
import { verifyEd25519 } from "@lararium/mesh";
import { lockBrowserCustody, readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { runWardAct } from "../src/ward-core.js";
import { browserWardSign, BrowserWardRefused, type WardWorkerSpawn } from "../src/browser-ward.js";

const PASS = "the browser face's route";
const fresh = () => `lares:ward-${globalThis.crypto.randomUUID()}`;

/** A worker double: the pure core behind a MessagePort, observing what crosses the port and whether the page's unlock moved. */
function spawnCore(idbName: string, seen: { answers: unknown[]; unlockedDuring: boolean[] }): WardWorkerSpawn {
  return () => ({
    postMessage(_msg, transfer) {
      const port = transfer[0] as MessagePort;
      port.onmessage = async (m) => {
        seen.unlockedDuring.push((await readBrowserCustody(idbName)).reading === "sealed" && (await readBrowserCustody(idbName) as { unlocked: boolean }).unlocked);
        const answer = await runWardAct(m.data);
        seen.answers.push(answer);
        port.postMessage(answer);
      };
    },
    terminate() { /* the act is done */ },
  });
}

async function wardedBrowser() {
  const idbName = fresh();
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  const root = await generateOrLoadBrowserPersonaRoot(idbName, 0);
  lockBrowserCustody(idbName);
  return { idbName, rootKey: root.verifyingKey };
}

describe("a browser ward act", () => {
  test("RED: with the page locked, the ward signs from the typed passphrase alone, the page stays locked before, during and after, and only the key and the signature cross the port; CONTROL: the signature verifies under the root", async () => {
    const { idbName, rootKey } = await wardedBrowser();
    const seen = { answers: [] as unknown[], unlockedDuring: [] as boolean[] };
    expect((await readBrowserCustody(idbName) as { unlocked: boolean }).unlocked).toBe(false);
    const bytes = new TextEncoder().encode("a kapae-lower over (daemon, digest)");
    const signed = await browserWardSign(idbName, 0, PASS, bytes, spawnCore(idbName, seen));
    expect(seen.unlockedDuring).toEqual([false]);
    expect((await readBrowserCustody(idbName) as { unlocked: boolean }).unlocked).toBe(false);
    expect(seen.answers).toHaveLength(1);
    expect(Object.keys(seen.answers[0] as object).sort()).toEqual(["key", "signature"]);
    expect(signed.key).toBe(rootKey);
    expect(verifyEd25519(signed.signature, bytes, rootKey)).toBe(true);
  });

  test("RED: a wrong passphrase or none refuses by name and crosses no key; CONTROL: the right one signs", async () => {
    const { idbName } = await wardedBrowser();
    const seen = { answers: [] as unknown[], unlockedDuring: [] as boolean[] };
    await expect(browserWardSign(idbName, 0, "not the route", new Uint8Array([1]), spawnCore(idbName, seen))).rejects.toThrow(BrowserWardRefused);
    expect(seen.answers).toEqual([{ refused: "ward-no-slot-opens" }]);
    await expect(browserWardSign(idbName, 0, "", new Uint8Array([1]), spawnCore(idbName, seen))).rejects.toMatchObject({ reading: "ward-needs-fresh-unlock" });
    expect((await browserWardSign(idbName, 0, PASS, new Uint8Array([1]), spawnCore(idbName, seen))).signature).toMatch(/^[0-9a-f]+$/);
  });
});

describe("the browser ward spends attempts (S2 cold read, P3)", () => {
  test("RED: three wrong passphrases spend the page's ward attempts, and the right one then refuses `ward-attempts-spent`; CONTROL: a fresh keystore's right passphrase signs", async () => {
    const { idbName } = await wardedBrowser();
    const seen = { answers: [] as unknown[], unlockedDuring: [] as boolean[] };
    for (let i = 0; i < 3; i++) await expect(browserWardSign(idbName, 0, `wrong ${i}`, new Uint8Array([1]), spawnCore(idbName, seen))).rejects.toMatchObject({ reading: "ward-no-slot-opens" });
    await expect(browserWardSign(idbName, 0, PASS, new Uint8Array([1]), spawnCore(idbName, seen))).rejects.toMatchObject({ reading: "ward-attempts-spent" });
    const other = await wardedBrowser();
    expect((await browserWardSign(other.idbName, 0, PASS, new Uint8Array([1]), spawnCore(other.idbName, seen))).signature).toMatch(/^[0-9a-f]+$/);
  });
});
