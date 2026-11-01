/**
 * e2e/meme-realm-bag — a bag two OPERATORS keep through a relation (basket-one #/the-shared-bag, ruled
 * 2026-09-11: "the shared bag registers in the realm's shared CRDT, @crossroads names only that it exists,
 * read at CONTRACT"). The brief: `bags/lares/ha.ka.ba/lares/docs/pono/realm-bag-brief.mem`.
 *
 * Two vessels, two roots — B founds its OWN (no admit edge) and dials A at the cross-operator floor. The
 * relation's four doors run as the docker `meme` scenario runs them (`tools/mesh-scenarios.sh` contract_ab):
 * A seats a charter · the charter crosses by `seal export`/`seal import` · B signs her contract-in · A's
 * quorum admits her. A LOADs a carrier into `bags/ford`. THE VECTOR: B's `meme get --bag ford <uri>`.
 *
 * MEASURED (the law rests at lar:///ha.ka.ba/lararium/api/personal-slot): each operator mints its own `bags/ford` doc, the
 * contract writes the carriage-contracts board and never a bag, and B answers `not-found`. BUILT: the realm's
 * shared CRDT materializes on both members' boot from the charter's genesis epoch (`realmDocUrl`); A REGISTERS
 * her `bags/ford` on it (`lares nexus realm-bag ford` — steward-signed, read at CONTRACT); @crossroads
 * carries `{ bag, kept-by }` alone; B's third reach (`meme-verbs.ts` reach-by-access) walks the realm plane
 * FIRST and finds the doc, which A's wire gate federates to a contracted MEMBER and to nobody else.
 *
 * CONTROLS: before the registration, B answers exactly what a non-member answers after it (`not-found`,
 * byte-identical); C — a third operator dialing A with no contract — answers `not-found` after it too; a
 * crossroads read of the bag's meme shows no record; B's `meme put --bag ford` refuses (read tier). The live `lares` and `lararium` documents are no relation's book: they cross to Kahu hands alone (⑭, road P26).
 *
 * THE WIRE UNDER THE REALM — TWO MAPS, NEVER LINKED. B boots before any contract and dials A at the
 * cross-operator floor, presenting her ContactCard ALONE: a self-founded vessel presents no root-signed edge
 * on any socket, because its one vessel key would link that root to the leaf it presents to the same Nexus.
 * A's Nexus stays PRIVATE throughout: B is a stranger, and a private gate answers a stranger with silence, so
 * no board of A's crosses to B while she is one. A's quorum
 * admits B's per-Nexus LEAF, and `nexus contract --json` emits the CARRIED admit bundle (the admit, its
 * lineage, the Nexus, A's gate key); it travels to B BY FILE, as the charter and the contract token travel,
 * and B's `nexus admit-take` verifies it against the charter she holds, keeps it, and drives her running
 * vessel's refresh. B RE-DIALS and presents the leaf admit, its lineage and the leaf's proof over A's
 * challenge — and no root-signed edge (no proof binding a leaf to a root travels on the wire). A's seat
 * verifies the proof and holds the admit against its deny board: B's LEAF enters A's leaf map, which the
 * membership consult reads, while A's ROOT map stays empty. THE STEWARD SIGNER: each operator's realm-bag act
 * names her face (`--face 0`), and the realm record seals with the key that face presents
 * to this Nexus — the very key her contract-in names — so no persona root reaches `keptBy` or the public
 * announce. A NAME ENTERS A RECORD BY ITS OWN HAND FIRST: B ASKS to keep the bag from her own vessel
 * (`realm-bag lares --join`) and A consents (`--cosign`); A naming a key that sealed nothing in the realm
 * refuses `steward-name-unproven`. The share verdict seats on BOTH of
 * automerge-repo's hooks (announce AND access) and reads the admission maps AFTER they land — a stranger at
 * the floor asking for a private plane by its genesis-derived id draws nothing.
 *
 * ⑬ MEASURES WHERE A RETURN LANE WOULD STOP. Two laws hold the book open across the steward write path: a
 * record still short of a seal rests under its own key, so B's ask never unseats A's counted registration
 * (`realmBagProposalKey`); and every fold fires the reverdict (`makeRealmPlane` `onRefold` →
 * `repo.shareConfigChanged`), so a consent that lands as a CHANGE on the shared realm doc reaches the verdict
 * the Repo caches per (doc, peer). ⑬ keeps measuring, and
 * (vi) QUOTES THE WIRE: both daemons run with `LAR_WIRE_LOG=1`, so every verdict either share hook answers and
 * every sync message either Repo moves prints a `[wire]` line, filtered here to the registered book's own id.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { DEVICE_DELEGATION_SELF_TIDDLER, edgeLedgerDocUrl, storedLarRecord, type GateBundlePin, type LarDoc } from "../../packages/lararium-mesh/src/index.js";
import { LarWSClientAdapter, hearthPinIndex, DAEMON_BAG_ID, strangerFace } from "../../packages/lararium-node/probes/crossing-synthetic-world.js";
import {
  openStaged, freePort, stageDir, awaitRendezvous, ownGateKey, bootDocUrl, vesselStorageDir, foundStagedHearth, growStagedQuorum,
  type LarInstance,
} from "../harness/instance.js";
import { seedUserBag } from "../harness/promote.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t.witness.ford/ledger";
const URI  = `lar:///${PATH}`;
const LARES_BAG = "lar:///ha.ka.ba/bags/ford";   // the user bag the relation keeps (system canon rests in the Kahu realm, never a relation's)
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

/** The ledger with a second slot — B's edit, the one A must read back through the ford. */
const memeWithSlot = (slot = "/b"): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "salt: 12 · barley: 40"\n\`\`\`\n\n<<~ ahu #/count>>\n\n! the count\n\n<<~/ahu>>\n\n<<~ ahu #${slot}>>\n\n! the highland tally\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** One carrier for A's own live Kahu canon (`@lares`), landed by the canon's ingest door (road P26's walk). */
const KAHU_PATH = "p26.kahu.walk/ledger";
const KAHU_URI  = `lar:///${KAHU_PATH}`;
const kahuMeme = (): string =>
  `<<^ code="&#x0001;" from="?" -> to="${KAHU_URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${KAHU_PATH}"\n\`\`\`\n\n<<~ ahu #/count>>\n\n! the steward's line\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const meme = (): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "salt: 12 · barley: 40"\n\`\`\`\n\n<<~ ahu #/count>>\n\n! the count\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds two vessels");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`meme-realm-bag: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let B: LarInstance | null = null;
/** C — a third operator dialing A at the same floor, contracted into NOTHING: the non-member CONTROL. */
let C: LarInstance | null = null;
let rootB = "";
let rootC = "";
/** Each operator's persona ROOT, read off its own founding door (`persona new 0 --json`). */
const rootNymOf = new Map<string, string>();
/** The relation's doors, as they answered — the gate on the vector. */
let contracted = false;
/** L3: `accept-carriage`'s own poke truthfully claimed B's standing vessel refolded live. */
let refoldLive = false;
let doors = "";
/** A's Nexus AID and A's realm id: B carries the one and names the other on every realm-scoped call. */
let aidA = "";
let realmA = "";
/** The bags a `nexus realm-bags` answer lists. */
const bagsOf = (r: { json: Record<string, unknown> | null }): string[] =>
  (((r.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>).map((b) => String(b["bag"]));
/** B's answer BEFORE any registration — the byte-identical "today" a non-member keeps drawing. */
let beforeB = "";
let contractNym = "";
/** A's port, and the sovereign gate pin her admit bundle carries: what C (and B) dial A's gate under. */
let portAOuter = 0;
let gatePinA: GateBundlePin | null = null;
/** How many dials A's gate has let fall silent, read off her own log. */
const silencesIn = (log: string): number => log.split("\n").filter((l) => l.includes("[lar-gate]") && l.includes("fell silent")).length;
/** Wait, bounded, for a line to land in a vessel's log; resolves whether it did. */
async function awaitLog(who: LarInstance, re: RegExp, ms: number): Promise<boolean> {
  for (const until = Date.now() + ms; Date.now() < until; ) {
    if (re.test(who.bootLog())) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return re.test(who.bootLog());
}
/** B's refusal at the read tier — the bytes ⑩ pins while her naming still waits on her own hand. */
let refusalB = "";
let named = false;
let bPut = false;
/** The error object alone, past the per-call requestId — the byte-identity a CONTROL compares. */
const errorOf = (text: string): string =>
  JSON.stringify((JSON.parse(text.split("\n").find((l) => l.startsWith("{")) ?? "{}") as Record<string, unknown>)["error"] ?? null);

describe.skipIf(gaps.length > 0)("★ a bag two operators keep through a relation ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-Bop-"));
    rootC = mkdtempSync(join(stageDir(), "lares-staged-Cop-"));
    const portA = await freePort();
    portAOuter = portA;
    const portB = await freePort();
    const portC = await freePort();
    // THE WIRE PROBE, armed on every staged vessel: each share verdict either hook answers and each sync
    // message the Repo moves prints a `[wire]` line on the daemon's own log, which ⑬ quotes for the
    // registered book alone. Unarmed (no env) the vessel wraps nothing.
    const wireLog = { LAR_WIRE_LOG: "1" };
    A = await openStaged({ tag: "A", port: portA, daemonEnv: wireLog, found: async (cliA, rootA) => {
      await foundStagedHearth(cliA, rootA, "spider-steward");
      const face = await cliA(["persona", "new", "0", "--name", "spider-steward", "--json"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      const treeKeyA = ((face.json?.["data"] ?? {}) as Record<string, unknown>)["verifyingKey"];
      if (typeof treeKeyA === "string") rootNymOf.set("A", treeKeyA.toLowerCase());
      // A FOUNDS THE NEXUS: its seed charter grows to the founding kahu who tend it by the roll its founding armed,
      // all BEFORE the daemon stands.
      await growStagedQuorum(cliA, rootA, ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
    // B: its OWN root, its own founding — a second OPERATOR, never a device of A's. C: a third, alike, that
    // never contracts.
    const foundOperator = (tag: string, name: string) => async (cli: (a: readonly string[]) => Promise<{ code: number; stderr: string; json: Record<string, unknown> | null }>, root: string) => {
      await foundStagedHearth(cli as never, root, name);
      const face = await cli(["persona", "new", "0", "--name", name, "--json"]);
      if (face.code !== 0) throw new Error(`${tag}: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      const treeKey = ((face.json?.["data"] ?? {}) as Record<string, unknown>)["verifyingKey"];
      if (typeof treeKey === "string") rootNymOf.set(tag, treeKey.toLowerCase());
    };
    // B and C dial A by the pin and address the admit bundle carries (`nexus contract --sync-url`).
    const dialA = { ...wireLog };
    // Each root is marked and founded independently before its daemon stands.
    B = await openStaged({ tag: "B", root: rootB, port: portB, found: foundOperator("B", "highland-steward"), daemonEnv: dialA });
    C = await openStaged({ tag: "C", root: rootC, port: portC, found: foundOperator("C", "court-spy"), daemonEnv: dialA });
    if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);
    if (!(await awaitRendezvous(C))) throw new Error(`C reached live but bound no rendezvous:\n${C.bootLog().slice(-800)}`);

    // THE RELATION'S FOUR DOORS — each answer kept, the gate below reads them.
    const lines: string[] = [];
    const show = await A.cli(["nexus", "seal", "show", "--json"]);
    lines.push(`A nexus seal show → ${show.code}: ${said(show).trim().slice(0, 240)}`);
    const exp = await A.cli(["nexus", "seal", "export", "--no-json"]);
    lines.push(`A nexus seal export → ${exp.code}: ${exp.stdout.length} chars`);
    let acc: { nym?: string; contractSig?: string } = {};
    if (exp.code === 0 && exp.stdout.trim()) {
      const charter = join(rootB, "a-charter.mem");
      writeFileSync(charter, exp.stdout);
      // B STANDS ON HER OWN SEED CHARTER: A's Nexus reaches her as a CARRIED charter, beside her own, and her
      // consent names it by its AID.
      const imp = await B.cli(["nexus", "seal", "import", "--carry", charter, "--json"]);
      lines.push(`B nexus seal import --carry → ${imp.code}: ${said(imp).trim().slice(0, 240)}`);
      aidA = String(((imp.json?.["data"] ?? {}) as Record<string, unknown>)["aid"] ?? "");
      const accept = await B.cli(["nexus", "accept-carriage", "--nexus", aidA, "--json"]);
      lines.push(`B nexus accept-carriage → ${accept.code}: ${said(accept).trim().slice(0, 240)}`);
      const data = (accept.json?.["data"] ?? accept.json ?? {}) as Record<string, unknown>;
      // L3 (the gp1 drift-ward this iteration closes): `accept-carriage` writes beside the seal home,
      // never on B's Repo, so her standing vessel refolds only through `pokeSealHomeRefold` — and the
      // answer now RIDES the JSON rather than vanishing into a discarded poke. B is a live standing
      // joinee here (not a direct, no-vessel act), so the refold must read truthfully DONE, never a
      // guess merely because a vessel stood to attempt it.
      lines.push(`B accept-carriage refold → ${String(data["refold"])}`);
      refoldLive = accept.code === 0 && data["refold"] === "done";
      acc = { ...(typeof data["nym"] === "string" ? { nym: data["nym"] } : {}), ...(typeof data["contractSig"] === "string" ? { contractSig: data["contractSig"] } : {}) };
      if (acc.nym && acc.contractSig) {
        contractNym = acc.nym;
        // A's Nexus stays PRIVATE: no board of A's crosses to B while she is a stranger. Her admit reaches her
        // as the charter and the token reach her — by FILE: the bundle `nexus contract --json` emits.
        const contract = await A.cli(["nexus", "contract", acc.nym, "--sig", acc.contractSig, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--json"]);
        lines.push(`A nexus contract → ${contract.code}: ${said(contract).trim().slice(0, 240)}`);
        const bundle = ((contract.json?.["data"] ?? {}) as Record<string, unknown>)["bundle"];
        if (contract.code === 0 && bundle) {
          const opening = ((bundle as Record<string, unknown>)["opening"] ?? {}) as { carriage?: { gatePin?: GateBundlePin } };
          gatePinA = opening.carriage?.gatePin ?? null;
          const bundleFile = join(rootB, "a-admit-bundle.json");
          writeFileSync(bundleFile, JSON.stringify(bundle));
          // L1: `nexus refresh` is a RETIRED verb — A's running node already refolded the instant
          // `nexus contract` landed above, through the SAME door-row `afterRoll` hook every write fires
          // (that call ran as a door row against A's standing vessel, not a direct, unwitnessed act).
          // B TAKES the bundle: verified against the charter she holds, kept beside her consent, and her running
          // vessel's `admit-take` row re-presents the dial live (it also stands the realm the imported charter names).
          const take = await B.cli(["nexus", "admit-take", bundleFile, "--json"]);
          lines.push(`B nexus admit-take → ${take.code}: ${said(take).trim().slice(0, 240)}`);
          contracted = take.code === 0 && ((take.json?.["data"] ?? {}) as Record<string, unknown>)["represented"] === true;
        }
      }
    }
    // A's realm, named on every realm-scoped call B and C make: each operator stands on her own seed, so the
    // realm a verb reads by default is her own, and A's arrives by name.
    const realmList = await A.cli(["nexus", "realm-bags", "--json"]);
    realmA = String(((realmList.json?.["data"] ?? {}) as Record<string, unknown>)["realm"] ?? "");
    lines.push(`A nexus realm-bags → realm ${realmA || "(none)"}`);
    doors = lines.join("\n  ");
    console.error(`meme-realm-bag MEASURE the relation's doors:\n  ${doors}`);
  }, 500_000);

  afterAll(async () => {
    if (C) await C.stop();
    if (B) await B.stop();
    if (A) await A.stop();
    if (rootB && existsSync(rootB)) rmSync(rootB, { recursive: true, force: true });
    if (rootC && existsSync(rootC)) rmSync(rootC, { recursive: true, force: true });
  });

  test("① two operators stand, each on its own root; B dials A at the cross-operator floor", () => {
    expect(A).not.toBeNull();
    expect(B).not.toBeNull();
    expect(B!.bootLog()).toContain("[nexus-join]");
  });

  test("② A mints the ford bag and puts the ledger into it — the steward's own write", async () => {
    const mint = await A!.cli(["act", "CREATE", "--bag", LARES_BAG, "--yes", "--json"]);
    expect(mint.json?.["ok"], said(mint)).toBe(true);
    const file = join(A!.root, "ford-stage-ledger.mem");
    writeFileSync(file, meme());
    await seedUserBag(A!, file, LARES_BAG);
    const got = await A!.cli(["meme", "get", URI, "--bag", "ford", "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(true);
  });

  test("③ MEASURE: the relation's doors, as they answered (the gate on the vector)", () => {
    console.error(`meme-realm-bag: contracted=${contracted} refoldLive=${refoldLive}`);
    expect(doors.length).toBeGreaterThan(0);
    expect(contracted, doors).toBe(true);
    // L3, live (closes the gp1 drift-ward "accept-carriage beside a standing joinee refolds live" left
    // with no red test): a vessel genuinely stood for this call, so the poke's answer must read truthfully
    // DONE — never a guess merely because a vessel stood to attempt it.
    expect(refoldLive, doors).toBe(true);
  });

  test("④ CONTROL (before): B holds the relation and not the bag — `not-found`, the measured today, with B's dial STANDING", async () => {
    // B must have DIALED before the control means anything: a `not-found` from a vessel that never reached A is not a
    // refusal of the bag, it is a disconnection. So the measure waits for B's own word that A's gate opened a crossing.
    const dialed = await awaitLog(B!, /\[lar-leaf\] verdict OK — crossing open, syncing/, 90_000);
    expect(dialed, `B never dialed A's gate:\n${B!.bootLog().split("\n").filter((l) => /nexus-join|lar-leaf|lar-gate/.test(l)).slice(-8).join("\n")}`).toBe(true);
    const r = await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    beforeB = said(r).trim();
    console.error(`meme-realm-bag MEASURE B before registration: ${beforeB.slice(0, 200)}`);
    expect(r.json?.["ok"]).toBe(false);
    // Named by A's realm, the read walks that realm alone: before any registration nothing reaches the bag there.
    expect(beforeB).toMatch(/not-found|nothing reaches it by access in realm/);
  }, 60_000);

  test("⑤ A registers her bag on the realm's shared CRDT — steward-signed, read at CONTRACT", async () => {
    const reg = await A!.cli(["nexus", "realm-bag", "ford", "--face", "0", "--json"]);
    console.error(`meme-realm-bag MEASURE A realm-bag: ${said(reg).trim().slice(0, 300)}`);
    expect(reg.json?.["ok"], said(reg)).toBe(true);
    const data = (reg.json?.["data"] ?? {}) as Record<string, unknown>;
    expect(data["bag"]).toBe(LARES_BAG);
    expect(data["readTier"]).toBe("contract");
    expect(Array.isArray(data["keptBy"]) && (data["keptBy"] as string[]).length).toBe(1);
    // THE STEWARD SIGNER: A's worn face seals with its per-Nexus key, and her persona root stays home.
    const rootA = rootNymOf.get("A") ?? "";
    expect(rootA, "A's persona root, read off her founding door").toMatch(/^[0-9a-f]{64}$/);
    expect((data["keptBy"] as string[]).map((n) => n.toLowerCase())).not.toContain(rootA);
    expect((data["signedBy"] as string[]).map((n) => n.toLowerCase())).not.toContain(rootA);
    const list = await A!.cli(["nexus", "realm-bags", "--json"]);
    const bags = ((list.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    expect(bags.map((b) => b["bag"])).toContain(LARES_BAG);
  }, 60_000);

  test("⑥ CONTROL: @crossroads carries that the bag exists and who keeps it — never its content", async () => {
    // The crossroads plane holds no record of the ledger's meme: the count never rides the herm.
    const r = await A!.cli(["meme", "get", URI, "--bag", "crossroads", "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(false);
    expect(said(r)).toContain("not-found");
  }, 60_000);

  /** Poll B's `meme get --bag lares` until it answers ok, bounded — the docs cross by WS-sync, never faked. */
  const pollB = async (ms: number) => {
    let r = await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    const until = Date.now() + ms;
    while (r.json?.["ok"] !== true && Date.now() < until) {
      await new Promise((res) => setTimeout(res, 3_000));
      r = await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    }
    return r;
  };

  /** One steward act on one vessel, bounded: the record it reads crosses by WS-sync, so the first attempt may
   *  find nothing yet. `--join` reads A's standing registration on B; `--cosign` reads B's ask on A. */
  const pollSteward = async (who: LarInstance, flag: "--join" | "--cosign", ms: number) => {
    const realm = who === A ? [] : ["--realm", realmA];
    let r = await who.cli(["nexus", "realm-bag", "ford", "--face", "0", flag, ...realm, "--json"]);
    const until = Date.now() + ms;
    while (r.json?.["ok"] !== true && Date.now() < until) {
      await new Promise((res) => setTimeout(res, 4_000));
      r = await who.cli(["nexus", "realm-bag", "ford", "--face", "0", flag, ...realm, "--json"]);
    }
    return r;
  };

  // THE VECTOR. B's `meme get --bag lares` walks the realm plane first (reach-by-access) and reads A's doc,
  // which A's wire gate federates to a contracted MEMBER. Gated on the contract: a refusal at a door above
  // reads at ③, never here.
  test("★ B's `meme get --bag lares` answers through the realm ★", async (ctx) => {
    if (!contracted) ctx.skip();
    const r = await pollB(60_000);
    console.error(`meme-realm-bag MEASURE B: meme get --bag lares → ${said(r).trim().slice(0, 300)}`);
    if (r.json?.["ok"] !== true) {
      // WHERE THE CROSSING STOPPED — the realm doc on B (did the registration arrive?), the nym B contracted
      // under against the key B presents at A's wire, and each side's realm lines.
      const bags = await B!.cli(["nexus", "realm-bags", "--realm", realmA, "--json"]);
      console.error(`meme-realm-bag MEASURE B realm-bags: ${said(bags).trim().slice(0, 400)}`);
      console.error(`meme-realm-bag MEASURE B gate key (presented at A): ${ownGateKey(B!.bootLog()) ?? "?"} · contract nym: ${contractNym}`);
      for (const [tag, v] of [["A", A!], ["B", B!]] as const) {
        const lines = v.bootLog().split("\n").filter((l) => /\[realm\]|nexus-join|sharePolicy|cross-operator|peer-class|admitted/.test(l)).slice(-8).join("\n  ");
        console.error(`meme-realm-bag MEASURE ${tag} lines:\n  ${lines}`);
      }
    }
    expect(r.json?.["ok"], said(r)).toBe(true);
    // The author's line as WRITTEN, aligned by the canonical render (`bag      = "…"`): the VALUE reads back byte-whole.
    expect(String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).toMatch(/bag +=  *"salt: 12 · barley: 40"/);
  }, 120_000);

  // THE MEASURE: B's own daemon says how each socket fared — on the ContactCard alone she is a STRANGER at A's
  // PRIVATE gate and meets SILENCE (no verdict, no refusal); on her LEAF admit, once she took the bundle A's quorum
  // emitted, A admits the socket and the crossing opens.
  test("MEASURE: the two-operator dial STANDS — B re-presents her LEAF admit with no root edge, A admits the socket", () => {
    const b = B!.bootLog();
    const lines = b.split("\n");
    const verdicts = lines.filter((l) => /\[lar-leaf\] (ANERGIZED|verdict)/.test(l));
    const verdict = verdicts.at(-1) ?? "(no verdict line)";
    console.error(`meme-realm-bag MEASURE B dial verdict: ${verdict.trim().slice(0, 200)}`);
    console.error(`meme-realm-bag MEASURE B gate key (presented at A): ${ownGateKey(b) ?? "?"} · contract nym: ${contractNym}`);
    if (process.env["LAR_STAGE_DIR"]) {
      writeFileSync(join(process.env["LAR_STAGE_DIR"], "realm-bag-A.log"), A!.bootLog());
      writeFileSync(join(process.env["LAR_STAGE_DIR"], "realm-bag-B.log"), b);
    }
    // B dials nobody until she holds an admit: the dial reads its pin and address off the bundle she TOOK, so the pins are
    // filed first, then the dial stands, then A's gate opens the crossing. No root edge rides any socket.
    expect(b).not.toContain("contract edge");
    const filedAt = lines.findIndex((l) => /\[nexus-join\] \d+ gate pin\(s\) filed \(/.test(l));
    const upAt = lines.findIndex((l) => l.includes("[nexus-join] nexus dial-out up →"));
    const okAt = lines.findIndex((l) => l.includes("[lar-leaf] verdict OK — crossing open, syncing"));
    console.error(`meme-realm-bag MEASURE B dial order: pins filed @${filedAt} · dial up @${upAt} · crossing open @${okAt}`);
    expect(filedAt, "B never filed A's gate pin from the admit she took").toBeGreaterThanOrEqual(0);
    expect(upAt, "B's dial never stood").toBeGreaterThan(filedAt);
    expect(okAt, "A's gate never opened B's crossing").toBeGreaterThan(upAt);
    // The sealed gate answers a dial it admits with a verdict and a stranger with silence: B's crossing opened, so her log
    // carries no anergy for A's gate, and no dial of hers drew a refusal.
    expect(lines.slice(okAt).some((l) => l.includes("[lar-leaf] ANERGIZED"))).toBe(false);
    // The leaf-admit dial stands.
    expect(lines.slice(okAt).some((l) => l.includes("[lar-leaf] verdict OK — crossing open, syncing"))).toBe(true);
    expect(verdict).toContain("verdict OK — crossing open, syncing");
  });

  test("⑦ CONTROL: C — a face that DIALS A's gate with NO contract — is met with silence and draws `not-found`, byte-identical to B's before", async () => {
    // C DIALS. A third operator's vessel holds no admit to take, so it has no pin and no address to dial from; the dial is
    // therefore stood here, in-process, as C's face would stand it: A's sovereign gate pin (public), a chain no admit backs.
    // A's gate answers a stranger at her PRIVATE Nexus with nothing, which her own log counts.
    expect(gatePinA, "A's admit bundle carried no gate pin to dial under").not.toBeNull();
    const silentBefore = silencesIn(A!.bootLog());
    const face = await strangerFace(aidA, "court-spy face");
    const pins = hearthPinIndex();
    pins.put("hearth-a", gatePinA!);
    const dial = new LarWSClientAdapter({
      url: `ws://127.0.0.1:${portAOuter}${gatePinA!.route}`, pins, hearth: "hearth-a", nexus: gatePinA!.nexus, audience: DAEMON_BAG_ID,
      deadlines: { draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } },
      presentation: { certificate: face.certificate, signer: face.signer, arm: face.arm, history: face.history },
      retryInterval: 500,
    });
    const cRepo = new Repo({ network: [dial] });
    try {
      const gotDoc = await Promise.race([
        cRepo.find(`automerge:${"1".repeat(27)}` as AutomergeUrl).then(() => "found", () => "unavailable"),
        new Promise<string>((r) => setTimeout(() => r("pending"), 8_000)),
      ]);
      expect(gotDoc, "C's dial reached a doc of A's").not.toBe("found");
      for (const until = Date.now() + 30_000; silencesIn(A!.bootLog()) <= silentBefore && Date.now() < until; ) await new Promise((r) => setTimeout(r, 1_000));
      expect(silencesIn(A!.bootLog()), `A's gate never fell silent on C's dial: C never reached it. A's gate lines:\n${A!.bootLog().split("\n").filter((l) => l.includes("[lar-gate]")).join("\n")}`).toBeGreaterThan(silentBefore);
    } finally {
      dial.disconnect();
      await cRepo.shutdown();
    }
    const r = await C!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    console.error(`meme-realm-bag MEASURE C: ${said(r).trim().slice(0, 200)}`);
    expect(r.json?.["ok"]).toBe(false);
    // Byte-identical past the per-call requestId — the error object itself.
    expect(errorOf(said(r))).toBe(errorOf(beforeB));
    // C carries no charter of A's: A's realm lists no bag of A's on C.
    const list = await C!.cli(["nexus", "realm-bags", "--realm", realmA, "--json"]);
    expect(bagsOf(list)).not.toContain(LARES_BAG);
  }, 60_000);

  test("⑧ CONTROL: a member at the read tier cannot `meme put --bag lares` — the stewards alone write", async () => {
    const file = join(rootB, "b-edit.mem");
    writeFileSync(file, meme());
    const r = await B!.cli(["meme", "put", URI, "--bag", "ford", "--realm", realmA, "--file", file, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(false);
    expect(said(r)).toMatch(/no writable layer|cannot write|refus|holds no steward's write in realm/i);
    refusalB = said(r);
  }, 60_000);

  // ── THE STEWARD WRITE PATH ──────────────────────────────────────────────────────────────────────
  // The read cap is CONTRACT; the write cap is the NAMED STEWARDS' SET. A name enters a record by its own hand
  // first: B ASKS to keep the bag, sealing with her worn face a record that names A's standing steward and
  // herself; it counts nothing until A's own hand consents, and A's registration keeps standing meanwhile.
  // Then B's `meme put --bag lares` resolves the REALM doc — the ford's one book — and A reads the new slot.

  test("⑨a CONTROL: A naming a key that sealed nothing in the realm refuses — no hand but its own writes a name", async () => {
    const stewardB = contractNym.toLowerCase();
    expect(stewardB, "B's per-Nexus key, read off her contract-in").toMatch(/^[0-9a-f]{64}$/);
    const reg = await A!.cli(["nexus", "realm-bag", "ford", "--face", "0", "--steward", stewardB, "--json"]);
    expect(reg.json?.["ok"], said(reg)).toBe(false);
    expect(said(reg)).toContain("steward-name-unproven");
    // A's own registration stands untouched by the refusal.
    const list = await A!.cli(["nexus", "realm-bags", "--json"]);
    const bags = ((list.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    expect(bags.map((b) => b["bag"])).toContain(LARES_BAG);
  }, 60_000);

  test("⑨ B asks to keep the bag — the record ACCRETES her name and waits on A's own hand", async () => {
    // THE STEWARD IS THE KEY B's WORN FACE PRESENTS TO THIS NEXUS — the nym her contract-in printed — and
    // never her persona root: the record travels, so whatever key it names gets published.
    const rootB = rootNymOf.get("B") ?? "";
    const stewardB = contractNym.toLowerCase();
    expect(rootB, "B's persona root, read off her founding door").toMatch(/^[0-9a-f]{64}$/);
    expect(rootB).not.toBe(stewardB);                                             // ROOT ⊥ LEAF
    const ask = await pollSteward(B!, "--join", 120_000);
    console.error(`meme-realm-bag MEASURE B asks to keep: ${said(ask).trim().slice(0, 300)}`);
    expect(ask.json?.["ok"], said(ask)).toBe(true);
    const data = (ask.json?.["data"] ?? {}) as Record<string, unknown>;
    const keptBy = (data["keptBy"] as string[]).map((n) => n.toLowerCase());
    expect(keptBy).toHaveLength(2);
    expect(keptBy).toContain(stewardB);
    expect(keptBy).not.toContain(rootB);
    expect((data["signedBy"] as string[]).map((n) => n.toLowerCase())).toEqual([stewardB]);
    // n-of-n: B alone cannot seat herself — her ask counts nothing until A's hand consents.
    expect(data["counts"]).toBe(false);
    expect((data["awaiting"] as string[])).toHaveLength(1);
    named = true;
  }, 180_000);

  test("⑩ CONTROL: while the ask waits, B's put still draws the SAME refusal and A's registration stands", async (ctx) => {
    if (!named) ctx.skip();
    const file = join(rootB, "b-edit.mem");
    const r = await B!.cli(["meme", "put", URI, "--bag", "ford", "--realm", realmA, "--file", file, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(false);
    expect(errorOf(said(r))).toBe(errorOf(refusalB));
    // The ask rests under its own key: A's counted registration keeps standing, kept by A alone.
    const list = await A!.cli(["nexus", "realm-bags", "--json"]);
    const bags = ((list.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    const lares = bags.find((b) => b["bag"] === LARES_BAG);
    expect(lares, said(list)).toBeDefined();
    expect((lares?.["keptBy"] as string[] | undefined)?.length).toBe(1);
  }, 60_000);

  test("★ A consents, then B's `meme put --bag lares` lands on the REALM doc ★", async (ctx) => {
    if (!named) ctx.skip();
    const co = await pollSteward(A!, "--cosign", 120_000);
    console.error(`meme-realm-bag MEASURE A consents: ${said(co).trim().slice(0, 300)}`);
    expect(co.json?.["ok"], said(co)).toBe(true);
    const coData = (co.json?.["data"] ?? {}) as Record<string, unknown>;
    expect(coData["counts"]).toBe(true);
    // Each worn face sealed with its per-Nexus key; neither operator's root stands on the completed record.
    const sealed = [...(coData["keptBy"] as string[]), ...(coData["signedBy"] as string[])].map((n) => n.toLowerCase());
    expect(sealed).toContain(contractNym.toLowerCase());
    expect(sealed).not.toContain(rootNymOf.get("A") ?? "");
    expect(sealed).not.toContain(rootNymOf.get("B") ?? "");

    // A's consent reaches B as a change on the shared realm doc; her write cap follows the fold that reads it.
    const until = Date.now() + 120_000;
    let put = { json: null as Record<string, unknown> | null, stdout: "", stderr: "" };
    const file = join(rootB, "b-slot.mem");
    writeFileSync(file, memeWithSlot());
    while (Date.now() < until) {
      const base = String(((await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"])).json?.["data"] as Record<string, unknown> | undefined)?.["canonicalHash"] ?? "");
      put = await B!.cli(["meme", "put", URI, "--bag", "ford", "--realm", realmA, "--base", base, "--file", file, "--json"]);
      if (put.json?.["ok"] === true) break;
      await new Promise((res) => setTimeout(res, 4_000));
    }
    console.error(`meme-realm-bag MEASURE B put: ${said(put).trim().slice(0, 300)}`);
    expect(put.json?.["ok"], said(put)).toBe(true);
    bPut = true;
  }, 360_000);

  // ⑪ STANDS. B's placement lands on the registration's own doc and A reads it back — the ford carries one
  // book in both directions. The wire that shows it (`LAR_WIRE_LOG=1` on both daemons, quoted by ⑬ (vi)):
  //     [wire] verdict announce peer=<B> doc=<bag> → true
  //     [wire] verdict access   peer=<B> doc=<bag> → true
  //     [wire] out doc=<bag> peer=<B> · [wire] in doc=<bag> peer=<B>
  // The verdict holds true from A's registration on: B's ask never unseats the record that stands, and A's
  // consent re-seats the wider record with a reverdict fired by the fold that read it.
  test("⑪ A's `meme get` reads B's new slot — the write crossed the ford, not a second chest", async (ctx) => {
    if (!bPut) ctx.skip();
    const until = Date.now() + 90_000;
    let text = "";
    while (Date.now() < until) {
      const r = await A!.cli(["meme", "get", URI, "--bag", "ford", "--json"]);
      text = String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
      if (text.includes("#/b")) break;
      await new Promise((res) => setTimeout(res, 3_000));
    }
    // B holds her own write whatever A reads — the placement landed, the lane did not open.
    const bGet = await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    expect(String((bGet.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? ""), said(bGet)).toContain("#/b");
    expect(text, `A never read B's slot`).toContain("#/b");
  }, 150_000);

  test("⑫ CONTROL: C — never named a steward — still cannot put; and B's STALE base moves nothing", async (ctx) => {
    if (!bPut) ctx.skip();
    const file = join(rootC, "c-edit.mem");
    writeFileSync(file, meme());
    const c = await C!.cli(["meme", "put", URI, "--bag", "ford", "--realm", realmA, "--file", file, "--json"]);
    expect(c.json?.["ok"], said(c)).toBe(false);

    const stale = join(rootB, "b-stale.mem");
    writeFileSync(stale, memeWithSlot("/stale"));
    const r = await B!.cli(["meme", "put", URI, "--bag", "ford", "--realm", realmA, "--base", "0".repeat(64), "--file", stale, "--json"]);
    const decision = String(((r.json?.["data"] ?? {}) as Record<string, unknown>)["decision"] ?? said(r));
    expect(decision, said(r)).toMatch(/conflict/i);
    const after = await A!.cli(["meme", "get", URI, "--bag", "ford", "--json"]);
    expect(String((after.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).not.toContain("#/stale");
  }, 150_000);
  // ⑭ THE KAHU CANON CROSSES ONLY TO KAHU HANDS (road P26; stable-founding-road #/rulings 2026-10-16 and 2026-10-18: the
  // live `lares` and `lararium` documents rest held by no vessel outside the Kahu cabal, and every other hand reads the
  // floor by CID). It runs while both daemons stand, ahead of ⑬'s teardown. A ingests one record into her OWN live canon
  // and reads it back, so the canon stands and holds a record to find. The ids B asks by are A's own registered Kahu
  // documents, read off both sides' realm view, so the ask names that very document. The same B that reads A's ford
  // through the realm (the control on the very lane) is answered that nothing reaches the record and is refused a write, for `@lares`
  // and `@lararium` both; ⑭b reads B's own store for either document by raw id once the daemons stop.
  const kahuDocs: { lares: string; lararium: string } = { lares: "", lararium: "" };
  test("⑭ A's live @lares and @lararium stand for A, and B — a contracted member — reads none of either and writes neither", async () => {
    expect(contracted, "the relation's doors stood (③): ⑭ walks only on a contracted member").toBe(true);
    const docOf = (r: { json: Record<string, unknown> | null }, bag: string): string =>
      String((((r.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>).find((b) => b["bag"] === bag)?.["doc"] ?? "");
    const aBags = await A!.cli(["nexus", "realm-bags", "--json"]);
    kahuDocs.lares = docOf(aBags, "lar:///ha.ka.ba/bags/lares");
    kahuDocs.lararium = docOf(aBags, "lar:///ha.ka.ba/bags/lararium");
    expect(kahuDocs.lares, `A's realm names her live @lares: ${said(aBags)}`).toMatch(/^automerge:/);
    expect(kahuDocs.lararium, `A's realm names her live @lararium: ${said(aBags)}`).toMatch(/^automerge:/);
    const bBags = await B!.cli(["nexus", "realm-bags", "--realm", realmA, "--json"]);
    expect(docOf(bBags, "lar:///ha.ka.ba/bags/lares"), "B's realm view names the same @lares document").toBe(kahuDocs.lares);
    expect(docOf(bBags, "lar:///ha.ka.ba/bags/lararium"), "B's realm view names the same @lararium document").toBe(kahuDocs.lararium);

    const dir = join(A!.root, "bags", "lares", "p26.kahu.walk");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.mem"), kahuMeme());
    const ing = await A!.cli(["ingest", "--source", dir, "--to", "lar:///ha.ka.ba/bags/lares", "--apply", "--yes", "--json"]);
    expect(ing.json?.["ok"], said(ing)).toBe(true);
    const own = await A!.cli(["meme", "get", KAHU_URI, "--bag", "lares", "--json"]);
    expect(own.json?.["ok"], `A's own canon reads its record: ${said(own)}`).toBe(true);

    const ford = await pollB(60_000);
    expect(ford.json?.["ok"], `CONTROL — B still reads A's ford through the realm: ${said(ford)}`).toBe(true);
    let r = await B!.cli(["meme", "get", KAHU_URI, "--bag", "lares", "--realm", realmA, "--json"]);
    for (const until = Date.now() + 30_000; r.json?.["ok"] !== true && Date.now() < until; ) {
      await new Promise((res) => setTimeout(res, 3_000));
      r = await B!.cli(["meme", "get", KAHU_URI, "--bag", "lares", "--realm", realmA, "--json"]);
    }
    console.error(`meme-realm-bag ⑭ MEASURE B: meme get --bag lares → ${said(r).trim().slice(0, 300)}`);
    expect(r.json?.["ok"], said(r)).not.toBe(true);
    // The realm reach asked for A's very document (B's view names its id, above) and nothing crossed: the reach door's own
    // refusal, measured on the first revised run.
    expect(said(r)).toContain("nothing reaches it by access");

    const file = join(B!.root, "kahu-walk-put.mem");
    writeFileSync(file, kahuMeme());
    for (const bag of ["lares", "lararium"]) {
      const put = await B!.cli(["meme", "put", KAHU_URI, "--bag", bag, "--realm", realmA, "--file", file, "--json"]);
      console.error(`meme-realm-bag ⑭ MEASURE B: meme put --bag ${bag} → ${said(put).trim().slice(0, 200)}`);
      expect(put.json?.["ok"], `B writes no ${bag}: ${said(put)}`).not.toBe(true);
    }
  }, 240_000);

  // ⑮ NO REGISTRATION WIDENS A VESSEL'S PRIVATE DOCUMENTS (lane `ralias`). A's catalog names itself and her daemon document
  // among its rows, so the realm-bag verb would read either as a book to register: the registration then seats the
  // document on A's realm gate and the realm lanes open it to every contracted member. A's vessel classes both
  // `vessel-private` by id: the registration never counts, so the verb refuses and B's realm view names neither.
  const privateDocsA: { daemon: string; catalog: string } = { daemon: "", catalog: "" };
  test("⑮ A's daemon document and catalog never become realm books: the registration refuses and B's realm view names neither", async () => {
    expect(contracted, "the relation's doors stood (③): ⑮ walks only on a contracted member").toBe(true);
    privateDocsA.daemon = bootDocUrl(A!, "daemon") ?? "";
    privateDocsA.catalog = bootDocUrl(A!, "catalog") ?? "";
    expect(privateDocsA.daemon && privateDocsA.catalog, "A's boot names her daemon document and catalog").toBeTruthy();
    for (const bag of ["lar:///ha.ka.ba/bags/catalog", "lar:///ha.ka.ba/bags/daemon"]) {
      const reg = await A!.cli(["nexus", "realm-bag", bag, "--face", "0", "--json"]);
      console.error(`meme-realm-bag ⑮ MEASURE A realm-bag ${bag} → ${said(reg).trim().slice(0, 300)}`);
      expect(reg.json?.["ok"], `A's ${bag} never registers: ${said(reg)}`).not.toBe(true);
    }
    const aBags = await A!.cli(["nexus", "realm-bags", "--json"]);
    const docs = (((aBags.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>).map((b) => String(b["doc"]));
    expect(docs, "A's realm seats neither private document").not.toContain(privateDocsA.daemon);
    expect(docs).not.toContain(privateDocsA.catalog);
    const bBags = await B!.cli(["nexus", "realm-bags", "--realm", realmA, "--json"]);
    const bDocs = (((bBags.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>).map((b) => String(b["doc"]));
    expect(bDocs, "B's realm view names neither").not.toContain(privateDocsA.daemon);
    expect(bDocs).not.toContain(privateDocsA.catalog);
    // CONTROL: the ford still crosses to B.
    const ford = await pollB(60_000);
    expect(ford.json?.["ok"], `CONTROL — B still reads A's ford through the realm: ${said(ford)}`).toBe(true);
  }, 180_000);

  // ⑮b A VESSEL'S EDGE LEDGER NEVER BECOMES A REALM BOOK (road `T33`, the class half). A's `ledger:edge` keeps her roll
  // marks, frontier pins and `seen` rows; its id derives from her atom key, which her device edge shows in the clear.
  // B, a contracted member, names that id on her OWN catalog, registers it on A's realm by her own seal alone, and asks
  // for it. Before the class, A's realm lane counted the registration and served the ledger to B (unit L0 measured the
  // lane). A's vessel classes the ledger `vessel-private` under the `device` owner: the fold refuses the registration and
  // the guard withholds it, so B's own store never holds the ledger. CONTROL: the ford still crosses.
  // A REGRESSION GUARD, NEVER RED: on the parent (no class, run 41269697445) B's lone registration landed, yet A's wire
  // peers drew `false` for the ledger and B's store held none of it, so no live member reaches the lane today. A's own
  // in-process islands read the ledger `true` by design (the house full-syncs), so the step reads B's store, never A's
  // verdict count. The MEASURE lines report whether A's fold counts the alias and every verdict A answered for it.
  test("⑮b A's edge ledger never crosses to B, whatever B registers on A's realm; the ford still crosses", async () => {
    expect(contracted, "the relation's doors stood (③): ⑮b walks only on a contracted member").toBe(true);
    // A's atom key, off her daemon document's device edge (read from a COPY of her store: her daemon keeps running).
    const daemonUrl = bootDocUrl(A!, "daemon");
    expect(daemonUrl, "A's boot names her daemon document").toBeTruthy();
    const copyA = mkdtempSync(join(stageDir(), "lares-ledger-copyA-"));
    cpSync(vesselStorageDir(A!), copyA, { recursive: true });
    const repoCopy = new Repo({ storage: new NodeFSStorageAdapter(copyA) });
    let atomKeyA = "";
    let ownLedgerA = "";
    try {
      const daemon = (await repoCopy.find<LarDoc>(daemonUrl as AutomergeUrl)).doc();
      atomKeyA = JSON.stringify(daemon?.tiddlers?.[DEVICE_DELEGATION_SELF_TIDDLER] ?? {}).match(/deviceVerifyingKey\\?"\s*:\s*\\?"(?:0x)?([0-9a-fA-F]{64})/)?.[1]?.toLowerCase() ?? "";
      // CONTROL for the store check below: A's own ledger holds rows under the ledger's prefix, so their absence on B reads.
      if (atomKeyA) {
        ownLedgerA = await Promise.race([
          repoCopy.find<LarDoc>(edgeLedgerDocUrl(atomKeyA)).then((h) => JSON.stringify(h.doc() ?? {}), () => "(unavailable)"),
          new Promise<string>((res) => setTimeout(() => res("(unavailable)"), 10_000)),
        ]);
      }
    } finally { await repoCopy.shutdown().catch(() => {}); rmSync(copyA, { recursive: true, force: true }); }
    expect(atomKeyA, "A's device edge names her atom key").toMatch(/^[0-9a-f]{64}$/);
    expect(ownLedgerA.includes("dreamnet/edge-ledger/"), `CONTROL — A's own store holds rows of her ledger: ${ownLedgerA.slice(0, 200)}`).toBe(true);
    const ledgerUrlA = edgeLedgerDocUrl(atomKeyA);
    const ledgerIdA = ledgerUrlA.slice("automerge:".length);
    // B names A's ledger on her own catalog (her daemon down for the write), then stands again on the same root.
    const ALIAS = "lar:///ha.ka.ba/bags/ledger-alias";
    const catalogUrlB = bootDocUrl(B!, "catalog");
    expect(catalogUrlB, "B's boot names her catalog").toBeTruthy();
    const portB = B!.port;
    await B!.stopDaemonOnly();
    const repoB = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(B!)) });
    try {
      const catalog = await repoB.find<LarDoc>(catalogUrlB as AutomergeUrl);
      catalog.change((d) => { d.tiddlers[ALIAS] = storedLarRecord(ALIAS, { text: ledgerUrlA }, "alias"); });
      await repoB.flush();
    } finally { await repoB.shutdown().catch(() => {}); }
    B = await openStaged({ tag: "B", root: rootB, port: portB, found: async () => {}, daemonEnv: { LAR_WIRE_LOG: "1" } });
    expect(await awaitRendezvous(B), `B stands again:\n${B.bootLog().slice(-800)}`).toBe(true);
    const back = await pollB(90_000);
    expect(back.json?.["ok"], `B crosses to A again before the ask: ${said(back)}`).toBe(true);
    // B registers the alias on A's realm by her own seal, then asks for it through the realm.
    const reg = await B.cli(["nexus", "realm-bag", ALIAS, "--face", "0", "--realm", realmA, "--json"]);
    console.error(`meme-realm-bag ⑮b MEASURE B realm-bag ${ALIAS} → ${said(reg).trim().slice(0, 300)}`);
    for (let i = 0; i < 3; i++) {
      const ask = await B.cli(["meme", "get", "--bag", ALIAS, "--realm", realmA, URI, "--json"]);
      console.error(`meme-realm-bag ⑮b MEASURE B meme get --bag ${ALIAS} → ${said(ask).trim().slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    const aBags = await A!.cli(["nexus", "realm-bags", "--json"]);
    console.error(`meme-realm-bag ⑮b MEASURE A's realm counts the alias: ${bagsOf(aBags).includes(ALIAS)}`);
    const lines = A!.bootLog().split("\n").map((l) => l.trim()).filter((l) => l.startsWith("[wire] verdict") && l.includes(ledgerIdA));
    console.error(`meme-realm-bag ⑮b MEASURE A's verdicts for her ledger ${ledgerIdA}:\n  ${lines.join("\n  ") || "(none)"}`);
    // CONTROL: the ford still crosses to B.
    const ford = await pollB(60_000);
    expect(ford.json?.["ok"], `CONTROL — B still reads A's ford through the realm: ${said(ford)}`).toBe(true);
    // B's own store, read from a COPY (her daemon keeps running for the steps after): no row of A's ledger stands there.
    const copyB = mkdtempSync(join(stageDir(), "lares-ledger-copyB-"));
    cpSync(vesselStorageDir(B), copyB, { recursive: true });
    const repoCopyB = new Repo({ storage: new NodeFSStorageAdapter(copyB) });
    try {
      const body = await Promise.race([
        repoCopyB.find<LarDoc>(ledgerUrlA as AutomergeUrl).then((h) => JSON.stringify(h.doc() ?? {}), () => "(unavailable)"),
        new Promise<string>((res) => setTimeout(() => res("(unavailable)"), 10_000)),
      ]);
      console.error(`meme-realm-bag ⑮b MEASURE B's store for A's ledger: ${body.slice(0, 160)}`);
      expect(body.includes("dreamnet/edge-ledger/"), `B's store holds A's edge ledger: ${body.slice(0, 200)}`).toBe(false);
    } finally { await repoCopyB.shutdown().catch(() => {}); rmSync(copyB, { recursive: true, force: true }); }
  }, 360_000);

  // ── ⑬ THE MEASURE: WHERE THE RETURN LANE STOPS ──────────────────────────────────────────────────
  // ⑪ stands red and its header names the seam as "past the wire" without saying WHICH of three stops
  // it is. This measure separates them on ONE run, and it runs LAST because its third probe takes A's
  // daemon down (its staged root alone — the home vessel is never touched).
  //
  //   (i)   A's REPLICA — does the doc the registration NAMES, read straight off A's own automerge
  //         storage with the daemon stopped, carry B's `#/b` slot?
  //   (ii)  A's READ — `resolveSink`'s get branch consults `composite.storeForBag(bag)` BEFORE
  //         `reach`/`realmReach` (`packages/lararium-tw5/src/meme-verbs.ts` resolveSink, the `mode === "get"`
  //         fall-through). A's PUT walks the realm FIRST (`opts.realmWritable` in the same function). So
  //         A writing a marker and failing to read it back proves the two doors land on DIFFERENT docs.
  //   (iii) A's VERDICT — the registry pointer A's catalog holds for `bags/lares` against the
  //         `docUrl` the standing registration names: one book, or two chests.
  test("⑬ MEASURE: where the return lane stops — A's read, A's replica, or the book's identity", async (ctx) => {
    if (!bPut) ctx.skip();
    const lines: string[] = [];

    // (iii-a) the two doc names, side by side.
    const bags = await A!.cli(["nexus", "realm-bags", "--json"]);
    const regs = ((bags.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    const registered = String(regs.find((r) => r["bag"] === LARES_BAG)?.["doc"] ?? "");
    const realmDoc = String((bags.json?.["data"] as Record<string, unknown> | undefined)?.["realmDoc"] ?? "");
    const bBags = await B!.cli(["nexus", "realm-bags", "--realm", realmA, "--json"]);
    const bRegs = ((bBags.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    const bRegistered = String(bRegs.find((r) => r["bag"] === LARES_BAG)?.["doc"] ?? "");
    lines.push(`(iii) registration doc — A says ${registered || "(none)"} · B says ${bRegistered || "(none)"} · same book: ${registered !== "" && registered === bRegistered}`);

    // (vi) THE WIRE, QUOTED. Both daemons carry `LAR_WIRE_LOG=1`, so every verdict either share hook answered
    // and every sync message either Repo moved prints a `[wire]` line. Filtered to the registered book's own
    // document id, the sequence names where that doc entered a peer's sync session and where it left it.
    const bagDocId = registered.replace(/^automerge:/, "").split(/[#/]/)[0] ?? "";
    const wireOf = (v: LarInstance): string[] =>
      v.bootLog().split("\n").map((l) => l.trim()).filter((l) => l.startsWith("[wire]") && bagDocId !== "" && l.includes(bagDocId));
    const aWire = wireOf(A!);
    const bWire = wireOf(B!);
    lines.push(`(vi) A's wire for ${bagDocId || "(no doc)"} — ${aWire.length} line(s):\n      ${aWire.slice(-30).join("\n      ") || "(none)"}`);
    lines.push(`(vi) B's wire for ${bagDocId || "(no doc)"} — ${bWire.length} line(s):\n      ${bWire.slice(-30).join("\n      ") || "(none)"}`);

    // (ii) A WRITES A MARKER AND READS IT BACK. The put walks the realm first; the get walks the
    // composite first. A read that misses A's OWN write names the read door, not the wire.
    const before = await A!.cli(["meme", "get", URI, "--bag", "ford", "--json"]);
    const beforeText = String((before.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    const baseA = String((before.json?.["data"] as Record<string, unknown> | undefined)?.["canonicalHash"] ?? "");
    const markerFile = join(A!.root, "a-marker.mem");
    writeFileSync(markerFile, memeWithSlot("/a-marker"));
    const aPut = await A!.cli(["meme", "put", URI, "--bag", "ford", "--base", baseA, "--file", markerFile, "--json"]);
    const after = await A!.cli(["meme", "get", URI, "--bag", "ford", "--json"]);
    const afterText = String((after.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    const readsOwnWrite = afterText.includes("#/a-marker");
    lines.push(`(ii) A's get carried B's slot before the marker: ${beforeText.includes("#/b")}`);
    lines.push(`(ii) A's own put → ${said(aPut).trim().slice(0, 200)}`);
    lines.push(`(ii) A reads back its OWN write: ${readsOwnWrite} — false means the put door and the get door hold DIFFERENT docs`);

    // (i) A'S REPLICA, OFF DISK. The daemon owns the store while it stands, so it stops first.
    const catalogUrl = bootDocUrl(A!, "catalog");
    await A!.stopDaemonOnly();
    let pointer = "";
    let replicaHasB = "unmeasured";
    let replicaHasMarker = "unmeasured";
    let aRealmTitles: string[] = [];
    let bRealmTitles: string[] = [];
    try {
      const repo = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(A!)) });
      if (catalogUrl) {
        const isle = await repo.find(catalogUrl as never);
        pointer = String((isle.doc() as { tiddlers?: Record<string, { tiddler?: { text?: string } }> })?.tiddlers?.[LARES_BAG]?.tiddler?.text ?? "");
      }
      if (realmDoc) {
        const rd = await repo.find(realmDoc as never);
        aRealmTitles = Object.keys((rd.doc() as { tiddlers?: Record<string, unknown> })?.tiddlers ?? {});
      }
      if (registered) {
        const held = await repo.find(registered as never);
        const rec = (held.doc() as { tiddlers?: Record<string, { tiddler?: { text?: string } }> })?.tiddlers?.[URI];
        const text = String(rec?.tiddler?.text ?? "");
        replicaHasB = String(text.includes("#/b") || JSON.stringify((held.doc() as object) ?? {}).includes("#/b"));
        replicaHasMarker = String(JSON.stringify((held.doc() as object) ?? {}).includes("#/a-marker"));
      }
    } catch (err) {
      lines.push(`(i) the replica read threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    // (iv) B'S SIDE OF THE SAME BOOK. A replica that never received the change and a WRITE that never
    // landed on this book read identically from A alone, so B answers for its own copy: what B's read
    // door says, and what B's own storage holds under the very same doc id.
    const bGet = await B!.cli(["meme", "get", URI, "--bag", "ford", "--realm", realmA, "--json"]);
    const bText = String((bGet.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    lines.push(`(iv) B's read door carries her own #/b: ${bText.includes("#/b")} · carries A's marker: ${bText.includes("#/a-marker")}`);
    await B!.stopDaemonOnly();
    let bReplicaHasB = "unmeasured";
    let bReplicaHasMarker = "unmeasured";
    try {
      const repoB = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(B!)) });
      if (realmDoc) {
        const rdB = await repoB.find(realmDoc as never);
        bRealmTitles = Object.keys((rdB.doc() as { tiddlers?: Record<string, unknown> })?.tiddlers ?? {});
      }
      if (registered) {
        const heldB = await repoB.find(registered as never);
        const body = JSON.stringify((heldB.doc() as object) ?? {});
        bReplicaHasB = String(body.includes("#/b"));
        bReplicaHasMarker = String(body.includes("#/a-marker"));
      }
    } catch (err) {
      lines.push(`(iv) B's replica read threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    lines.push(`(iv) B's on-disk replica of the SAME doc carries her #/b: ${bReplicaHasB} · carries A's marker: ${bReplicaHasMarker}`);
    // (v) THE CONTROL ON THE DIRECTION. B's co-signature is a record B wrote on the REALM doc — the same
    // B→A direction, a different document. A replica that carries B's co-sign and not B's slot says the
    // wire runs and the BAG doc alone stays behind; one that carries neither says the direction itself.
    const onlyB = bRealmTitles.filter((t) => !aRealmTitles.includes(t));
    lines.push(`(v) the realm doc ${realmDoc || "(none)"} — A holds ${aRealmTitles.length} record(s), B holds ${bRealmTitles.length}; B-only: ${onlyB.length === 0 ? "(none)" : onlyB.join(", ").slice(0, 300)}`);
    lines.push(`(iii-b) A's catalog registry names ${pointer || "(none)"} for ${LARES_BAG}`);
    lines.push(`(iii-b) registry pointer === registration doc: ${pointer !== "" && pointer === registered}`);
    lines.push(`(i) A's on-disk replica of the registered doc carries B's #/b: ${replicaHasB} · carries A's marker: ${replicaHasMarker}`);
    console.error(`meme-realm-bag ⑬ MEASURE where the lane stops:\n  ${lines.join("\n  ")}`);

    // The measure always reports; it never passes on absence of looking.
    expect(registered, `no standing registration for ${LARES_BAG} — the measure had nothing to read`).not.toBe("");
  }, 180_000);

  // ⑭b B'S OWN STORE, BY RAW ID. With B's daemon stopped (⑬ stops it; this stops it where ⑬ skipped), B's automerge
  // storage answers for each of A's live Kahu documents: a replica B never received holds no record of A's canon.
  test("⑭b B's own store holds neither of A's live Kahu documents, nor her daemon document or catalog (⑮)", async () => {
    expect(kahuDocs.lares && kahuDocs.lararium, "⑭ named both documents").toBeTruthy();
    try { await B!.stopDaemonOnly(); } catch { /* ⑬ already stopped it */ }
    const repoB = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(B!)) });
    try {
      for (const [bag, url] of [...Object.entries(kahuDocs), ...Object.entries(privateDocsA).filter(([, u]) => u !== "")]) {
        const body = await Promise.race([
          repoB.find(url as never).then((h) => JSON.stringify((h.doc() as object) ?? {}), () => "(unavailable)"),
          new Promise<string>((res) => setTimeout(() => res("(unavailable)"), 10_000)),
        ]);
        console.error(`meme-realm-bag ⑭b MEASURE B's store for ${bag} (${url}): ${body.slice(0, 160)}`);
        expect(body.includes("p26.kahu.walk") || body.includes("tiddlers\":{\"lar:"), `B's store holds A's ${bag}: ${body.slice(0, 200)}`).toBe(false);
      }
    } finally { await repoB.shutdown().catch(() => {}); }
  }, 60_000);
});
