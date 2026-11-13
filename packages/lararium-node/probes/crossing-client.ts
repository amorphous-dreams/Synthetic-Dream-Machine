/**
 * crossing-client — the BROWSER half of the containerized crossing, ROLE-DRIVEN so one probe proves the whole gate
 * contract across a real network hop. A browser-shaped face (a `LarWSClientAdapter` carrying a face presentation, the
 * shape lararium-browser dials with) attempts the crossing under a role (`crossing-roles.crossRole`). The EXIT CODE
 * carries the verdict (0 = the gate did the right thing).
 *
 * Roles (LAR_CROSS_ROLE), each a civic-protocol invariant:
 *   admitted    (X1/X5) an admitted face CROSSES + syncs the doc both ways: the breath.
 *   anon        (X2/A1) a gate that admits nobody turns the face away; the denied leaf then founds its OWN island
 *                       standalone: denied is not broken; the anon floor persists (veil-ladder#the-base-model).
 *   impostor    (X3)    a presentation signed by ANOTHER face's session signer is refused: possession proves who.
 *   wrong-bind  (X4)    a presentation bound to an audience the gate did not arm is refused.
 *
 * Env: LAR_CROSSING_SHARED (req) · LAR_CROSSING_DAEMON_HOST (default crossing-daemon) ·
 *      LAR_CROSSING_GREET (default "the DreamNet breathes") · LAR_CROSS_ROLE (default admitted)
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/the-veil-ladder (#the-base-model) · browser-crossing
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { KeyhiveProvider, InMemoryEventStore, foundCabalRealm } from "@lararium/keyhive";
import { crossRole, type CrossRole, type CrossingCoordinates } from "./crossing-roles.js";

const envOf = (k: string, d = ""): string => process.env[k] ?? d;
const SHARED = envOf("LAR_CROSSING_SHARED");
const HOST   = envOf("LAR_CROSSING_DAEMON_HOST", "crossing-daemon");
const GREET  = envOf("LAR_CROSSING_GREET", "the DreamNet breathes");
const ROLE   = envOf("LAR_CROSS_ROLE", "admitted") as CrossRole;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForFile(path: string, label: string): Promise<string> {
  for (let i = 0; i < 240; i++) {
    if (existsSync(path)) return readFileSync(path, "utf8");
    if (i === 0) console.log(`[crossing-client] (${ROLE}) awaiting ${label}…`);
    await sleep(500);
  }
  throw new Error(`timeout awaiting ${label}`);
}

/** The anon floor: a denied leaf MUST still stand as itself — found its own island, no group, no gate. */
async function foundStandaloneFloor(): Promise<void> {
  const provider = new KeyhiveProvider();
  await provider.init({ seed: new Uint8Array(32).fill(0x5a), eventStore: new InMemoryEventStore() });
  const realm = await foundCabalRealm(provider, "lar:///anon.floor.stands/denied-but-whole", "automerge:anon-floor-substrate");
  console.log(`[crossing-client] (anon) ✓ denied at the gate, yet WHOLE — founded own island realm=${realm.realmDocIdHex.slice(0, 12)}…`);
  await provider.dispose();
}

async function main(): Promise<void> {
  if (!SHARED) throw new Error("LAR_CROSSING_SHARED required");
  const coordinates = JSON.parse(await waitForFile(join(SHARED, "crossing.json"), "crossing coordinates")) as CrossingCoordinates;
  const verdict = await crossRole(ROLE, { host: HOST, coordinates }, { greet: GREET, log: (line) => console.log(line) });
  if (!verdict.ok) { console.log(`[crossing-client] (${ROLE}) ✗ ${verdict.detail}`); process.exit(1); }
  console.log(`[crossing-client] (${ROLE}) ✓ ${verdict.detail}`);
  if (ROLE === "anon") await foundStandaloneFloor();   // denied is not broken: the floor persists
  console.log(`[crossing-client] (${ROLE}) ✓ CROSSING CONTRACT HELD`);
  process.exit(0);
}

main().catch((e) => { console.error(`[crossing-client] (${ROLE}) ✗ FATAL:`, e); process.exit(1); });
