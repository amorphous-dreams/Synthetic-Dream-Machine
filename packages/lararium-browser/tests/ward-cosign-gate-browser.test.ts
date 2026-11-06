/**
 * ward-cosign-gate-browser — row 7's S3b table under the browser vessel's own port (`browserWardCosignPort`), in chromium: the
 * worn face's plane and roster, the leaf's fleet board reading for standing, and a lower whose root signs in the real per-act
 * ward worker under the passphrase typed for it. The browser holds the kāpae lower alone of the three co-signed acts.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { deviceEdgeId, FLEET_HAND } from "@lararium/mesh";
import { browserWardCosignPort } from "../src/browser-ward-cosign.js";
import { sealBrowserKeystore, lockBrowserCustody } from "../src/browser-custody.js";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { runWardAct } from "../src/ward-core.js";
import { browserWardSigner } from "../src/browser-ward.js";
import { wardCosignTable } from "../../lararium-mesh/tests/ward-cosign-table.js";

const ROOT = "fleet-root";
const spawn = () => ({
  postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data)); }; },
  terminate() {},
});

wardCosignTable({
  name: "browser", acts: ["lower"],
  port: ({ group, atom, plane, devices, lineage, aside, unknown, frontier, wardKeys }) => browserWardCosignPort({ group, atom, plane,
    fold: () => ({ devices, cids: ["admit"], admissions: devices.map((deviceKey) => ({ deviceKey, cid: "admit" })),
      wardKeys: Object.fromEntries(devices.map((d) => [d.toLowerCase(), wardKeys.get(d)!])) }) as never,
    lineage: () => lineage,
    // The leaf's fleet reading as the board would hand it: a raise per device set aside (the frontier links count the ones they
    // registered), and one owed a roll for a device whose standing reads unknown.
    fleet: () => {
      const raised = new Set([...aside, ...[...frontier.counted.values()].flatMap((atoms) => [...atoms])]);
      return { root: ROOT, frontier: (frontier.known ? { status: "known", asOf: { [FLEET_HAND]: { seq: 0, cid: frontier.head } }, counted: {} } : { status: "unknown", missing: [] }) as never,
        links: new Map([...frontier.counted].map(([cid, atoms]) => [cid, [...atoms].map((k) => `raise:${k}`)] as const)),
        readings: new Map([...[...raised].map((k) => [deviceEdgeId(ROOT, k), { stands: aside.has(k), raiseCids: [`raise:${k}`] } as never] as const),
          ...[...unknown].map((k) => [deviceEdgeId(ROOT, k), { stands: false, raiseCids: ["owed-a-roll"] } as never] as const)]) };
    },
  }),
  // The face root as the browser opens it: sealed under the keystore, signing in the per-act ward worker from the typed passphrase.
  root: async () => {
    const idbName = `lares:cosign-${globalThis.crypto.randomUUID()}`, PASS = "the route typed for this act";
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
    const root = await generateOrLoadBrowserPersonaRoot(idbName, 0);
    lockBrowserCustody(idbName);
    return { key: root.verifyingKey, signer: () => browserWardSigner(idbName, 0, PASS, spawn) };
  },
});
