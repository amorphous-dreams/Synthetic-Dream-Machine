/**
 * e2e/meme-realm-bag — a bag two OPERATORS keep through a relation (basket-one #/the-shared-bag, ruled
 * 2026-09-11: "the shared bag registers in the realm's shared CRDT, @crossroads names only that it exists,
 * read at CONTRACT"). The brief: `bags/lares/ha.ka.ba/lares/docs/pono/realm-bag-brief.mem`.
 *
 * Two vessels, two roots — B founds its OWN (no admit edge) and dials A at the cross-operator floor. The
 * relation's four doors run as the docker `meme` scenario runs them (`tools/mesh-scenarios.sh` contract_ab):
 * A seats a charter · the charter crosses by `seal export`/`seal import` · B signs her contract-in · A's
 * quorum admits her. A LOADs a carrier into `bags/lares`. THE VECTOR: B's `meme get --bag lares <uri>`.
 *
 * MEASURED (seal-and-seat-handoff#/plan-relation-bag): each operator mints its own `bags/lares` doc, the
 * contract writes the carriage-contracts board and never a bag, and B answers `not-found`. BUILT: the realm's
 * shared CRDT materializes on both members' boot from the charter's genesis epoch (`realmDocUrl`); A REGISTERS
 * her `bags/lares` on it (`lares nexus realm-bag lares` — steward-signed, read at CONTRACT); @crossroads
 * carries `{ bag, kept-by }` alone; B's third reach (`meme-verbs.ts` reach-by-access) walks the realm plane
 * FIRST and finds the doc, which A's wire gate federates to a contracted MEMBER and to nobody else.
 *
 * CONTROLS: before the registration, B answers exactly what a non-member answers after it (`not-found`,
 * byte-identical); C — a third operator dialing A with no contract — answers `not-found` after it too; a
 * crossroads read of the bag's meme shows no record; B's `meme put --bag lares` refuses (read tier).
 *
 * THE WIRE UNDER THE REALM. A self-founded operator's own device edge presents in the wire's CONTRACT slot
 * (never the fleet slot, which chains to the founder's KEL and anergizes a foreign root); A admits the
 * ContactCard at the cross-operator floor, proves the edge offline, and `memberNym` binds the wire's vessel
 * key to the persona-root nym `accept-carriage` contracted under. The share verdict seats on BOTH of
 * automerge-repo's hooks (announce AND access) and reads the admission maps AFTER they land — a stranger at
 * the floor asking for a private plane by its genesis-derived id draws nothing.
 *
 * ⑬ MEASURED WHERE THE RETURN LANE STOPPED, and it stopped at the WIRE — one book, one crossing, and no sync
 * session after it. The stop was a STALE VERDICT: ⑨'s proposal, written under A's own nym, replaced A's
 * counted registration (`writeRealmBagRegistration` keys by bag + signing hand), the fold dropped the bag and
 * the realm leg denied it; B's co-signature re-seated it as a CHANGE on the shared realm doc, the plane
 * refolded — and nothing asked the Repo to re-read a verdict it caches per (doc, peer). The cure fires the
 * reverdict on every fold (`makeRealmPlane` `onRefold` → `repo.shareConfigChanged`). ⑬ keeps measuring, and
 * (vi) QUOTES THE WIRE: both daemons run with `LAR_WIRE_LOG=1`, so every verdict either share hook answers and
 * every sync message either Repo moves prints a `[wire]` line, filtered here to the registered book's own id.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  openStaged, freePort, stageDir, awaitRendezvous, bootDocUrl, vesselStorageDir, type LarInstance,
} from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t.witness.ford/ledger";
const URI  = `lar:///${PATH}`;
const LARES_BAG = "lar:///ha.ka.ba/bags/lares";
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

/** The ledger with a second slot — B's edit, the one A must read back through the ford. */
const memeWithSlot = (slot = "/b"): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "salt: 12 · barley: 40"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n<<~ ahu #/count>>\n\n! the count\n\n<<~/ahu>>\n\n<<~ ahu #${slot}>>\n\n! the highland tally\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

const meme = (): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "salt: 12 · barley: 40"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n<<~ ahu #/count>>\n\n! the count\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

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
/** The relation's doors, as they answered — the gate on the vector. */
let contracted = false;
let doors = "";
/** B's answer BEFORE any registration — the byte-identical "today" a non-member keeps drawing. */
let beforeB = "";
let contractNym = "";
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
    const portB = await freePort();
    const portC = await freePort();
    // THE WIRE PROBE, armed on every staged vessel: each share verdict either hook answers and each sync
    // message the Repo moves prints a `[wire]` line on the daemon's own log, which ⑬ quotes for the
    // registered book alone. Unarmed (no env) the vessel wraps nothing.
    const wireLog = { LAR_WIRE_LOG: "1" };
    A = await openStaged({ tag: "A", port: portA, daemonEnv: wireLog, found: async (cliA, rootA) => {
      const clear = await cliA(["vessel", "clear", "--root", rootA, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cliA(["persona", "new", "0", "--name", "spider-steward"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      // A FOUNDS THE NEXUS, so it seats the founding kahu who tend it — three chairs, a majority of two —
      // and `rite cabal` seats the charter, all BEFORE the daemon stands (tools/lararium-container-boot.sh:101-111).
      let i = 1;
      for (const handle of ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]) {
        const k = await cliA(["persona", "new", String(i), "--name", `kahu-${i}`, "--handle", handle, "--seat"]);
        if (k.code !== 0) throw new Error(`A: kahu ${i} failed (${k.code})\n${k.stderr.slice(-800)}`);
        i += 1;
      }
      const rite = await cliA(["nexus", "rite", "cabal"]);
      if (rite.code !== 0) throw new Error(`A: rite cabal failed (${rite.code})\n${said(rite).slice(-800)}`);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
    const gateA = /gate key: ([0-9a-f]{64})/.exec(A.bootLog())?.[1] ?? "";
    // B: its OWN root, its own founding — a second OPERATOR, never a device of A's. C: a third, alike, that
    // never contracts.
    const foundOperator = (tag: string, name: string) => async (cli: (a: readonly string[]) => Promise<{ code: number; stderr: string }>, root: string) => {
      const clear = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`${tag}: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cli(["persona", "new", "0", "--name", name]);
      if (face.code !== 0) throw new Error(`${tag}: face failed (${face.code})\n${face.stderr.slice(-800)}`);
    };
    const dialA = { ...wireLog, LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA };
    // Sequential: `vessel clear` holds the fresh-build lock, and two clears racing refuse each other.
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
      const imp = await B.cli(["nexus", "seal", "import", charter, "--json"]);
      lines.push(`B nexus seal import → ${imp.code}: ${said(imp).trim().slice(0, 240)}`);
      const accept = await B.cli(["nexus", "accept-carriage", "--json"]);
      lines.push(`B nexus accept-carriage → ${accept.code}: ${said(accept).trim().slice(0, 240)}`);
      const data = (accept.json?.["data"] ?? accept.json ?? {}) as Record<string, unknown>;
      acc = { ...(typeof data["nym"] === "string" ? { nym: data["nym"] } : {}), ...(typeof data["contractSig"] === "string" ? { contractSig: data["contractSig"] } : {}) };
      if (acc.nym && acc.contractSig) {
        contractNym = acc.nym;
        const contract = await A.cli(["nexus", "contract", acc.nym, "--sig", acc.contractSig, "--json"]);
        lines.push(`A nexus contract → ${contract.code}: ${said(contract).trim().slice(0, 240)}`);
        contracted = contract.code === 0;
        // BOTH sides re-fold: A's running node folds the admit the CLI wrote beside it (its live member set
        // now names B at the wire); B stands the realm the imported charter names.
        const refreshA = await A.cli(["nexus", "refresh", "--json"]);
        lines.push(`A nexus refresh → ${refreshA.code}: ${said(refreshA).trim().slice(0, 200)}`);
        const refresh = await B.cli(["nexus", "refresh", "--json"]);
        lines.push(`B nexus refresh → ${refresh.code}: ${said(refresh).trim().slice(0, 200)}`);
      }
    }
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

  test("② A LOADs the ledger into its bags/lares — the steward's own write", async () => {
    const dir = join(A!.root, "ford-stage/bags/lares", "t.witness.ford");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.mem"), meme());
    const ld = await A!.cli(["act", "LOAD", "--source-uri", dir, "--to", LARES_BAG, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    const got = await A!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(true);
  });

  test("③ MEASURE: the relation's doors, as they answered (the gate on the vector)", () => {
    console.error(`meme-realm-bag: contracted=${contracted}`);
    expect(doors.length).toBeGreaterThan(0);
    expect(contracted, doors).toBe(true);
  });

  test("④ CONTROL (before): B holds the relation and not the bag — `not-found`, the measured today", async () => {
    const r = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    beforeB = said(r).trim();
    console.error(`meme-realm-bag MEASURE B before registration: ${beforeB.slice(0, 200)}`);
    expect(r.json?.["ok"]).toBe(false);
    expect(beforeB).toContain("not-found");
  }, 60_000);

  test("⑤ A registers her bag on the realm's shared CRDT — steward-signed, read at CONTRACT", async () => {
    const reg = await A!.cli(["nexus", "realm-bag", "lares", "--json"]);
    console.error(`meme-realm-bag MEASURE A realm-bag: ${said(reg).trim().slice(0, 300)}`);
    expect(reg.json?.["ok"], said(reg)).toBe(true);
    const data = (reg.json?.["data"] ?? {}) as Record<string, unknown>;
    expect(data["bag"]).toBe(LARES_BAG);
    expect(data["readTier"]).toBe("contract");
    expect(Array.isArray(data["keptBy"]) && (data["keptBy"] as string[]).length).toBe(1);
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
    let r = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    const until = Date.now() + ms;
    while (r.json?.["ok"] !== true && Date.now() < until) {
      await new Promise((res) => setTimeout(res, 3_000));
      r = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    }
    return r;
  };

  /** B's co-sign, bounded: A's proposal crosses by WS-sync, so the first attempt may find nothing yet. */
  const pollCoSign = async (ms: number) => {
    let r = await B!.cli(["nexus", "realm-bag", "lares", "--cosign", "--json"]);
    const until = Date.now() + ms;
    while (r.json?.["ok"] !== true && Date.now() < until) {
      await new Promise((res) => setTimeout(res, 4_000));
      r = await B!.cli(["nexus", "realm-bag", "lares", "--cosign", "--json"]);
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
      const bags = await B!.cli(["nexus", "realm-bags", "--json"]);
      console.error(`meme-realm-bag MEASURE B realm-bags: ${said(bags).trim().slice(0, 400)}`);
      console.error(`meme-realm-bag MEASURE B gate key (presented at A): ${/gate key: ([0-9a-f]{64})/.exec(B!.bootLog())?.[1] ?? "?"} · contract nym: ${contractNym}`);
      for (const [tag, v] of [["A", A!], ["B", B!]] as const) {
        const lines = v.bootLog().split("\n").filter((l) => /\[realm\]|nexus-join|sharePolicy|cross-operator|peer-class|admitted/.test(l)).slice(-8).join("\n  ");
        console.error(`meme-realm-bag MEASURE ${tag} lines:\n  ${lines}`);
      }
    }
    expect(r.json?.["ok"], said(r)).toBe(true);
    // The author's line as WRITTEN, aligned by the canonical render (`bag      = "…"`): the VALUE reads back byte-whole.
    expect(String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).toMatch(/bag +=  *"salt: 12 · barley: 40"/);
  }, 120_000);

  // THE MEASURE: B's own daemon says the socket stood — the contract edge rode its own slot and A admitted it.
  test("MEASURE: the two-operator dial STANDS — B presents the contract edge, A admits the socket", () => {
    const b = B!.bootLog();
    const verdict = b.split("\n").find((l) => /\[lar-leaf\] (ANERGIZED|verdict)/.test(l)) ?? "(no verdict line)";
    console.error(`meme-realm-bag MEASURE B dial verdict: ${verdict.trim().slice(0, 200)}`);
    console.error(`meme-realm-bag MEASURE B gate key (presented at A): ${/gate key: ([0-9a-f]{64})/.exec(b)?.[1] ?? "?"} · contract nym: ${contractNym}`);
    if (process.env["LAR_STAGE_DIR"]) {
      writeFileSync(join(process.env["LAR_STAGE_DIR"], "realm-bag-A.log"), A!.bootLog());
      writeFileSync(join(process.env["LAR_STAGE_DIR"], "realm-bag-B.log"), b);
    }
    expect(b).toContain("[nexus-join] presenting the contract edge");
    expect(b).not.toContain("[lar-leaf] ANERGIZED");
    expect(verdict).toContain("verdict OK — crossing open, syncing");
  });

  test("⑦ CONTROL: C — a proof-carrying operator with NO contract — draws `not-found`, byte-identical to B's before", async () => {
    const r = await C!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    console.error(`meme-realm-bag MEASURE C: ${said(r).trim().slice(0, 200)}`);
    expect(r.json?.["ok"]).toBe(false);
    // Byte-identical past the per-call requestId — the error object itself.
    expect(errorOf(said(r))).toBe(errorOf(beforeB));
    const list = await C!.cli(["nexus", "realm-bags", "--json"]);
    expect((list.json?.["data"] as Record<string, unknown> | undefined)?.["realm"] ?? null).toBeNull();
  }, 60_000);

  test("⑧ CONTROL: a member at the read tier cannot `meme put --bag lares` — the stewards alone write", async () => {
    const file = join(rootB, "b-edit.mem");
    writeFileSync(file, meme());
    const r = await B!.cli(["meme", "put", URI, "--bag", "lares", "--file", file, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(false);
    expect(said(r)).toMatch(/no writable layer|cannot write|refus/i);
    refusalB = said(r);
  }, 60_000);

  // ── THE STEWARD WRITE PATH ──────────────────────────────────────────────────────────────────────
  // The read cap is CONTRACT; the write cap is the NAMED STEWARDS' SET. A names B a steward; the record is
  // n-of-n, so the naming is a PROPOSAL that stands unregistered until B's own hand co-signs it. Then B's
  // `meme put --bag lares` resolves the REALM doc — the ford's one book — and A reads the new slot.

  test("⑨ A names B a steward — the record ACCRETES her name and waits on her own hand", async () => {
    const reg = await A!.cli(["nexus", "realm-bag", "lares", "--steward", contractNym, "--json"]);
    console.error(`meme-realm-bag MEASURE A names B: ${said(reg).trim().slice(0, 300)}`);
    expect(reg.json?.["ok"], said(reg)).toBe(true);
    const data = (reg.json?.["data"] ?? {}) as Record<string, unknown>;
    expect((data["keptBy"] as string[]).map((n) => n.toLowerCase())).toContain(contractNym.toLowerCase());
    // n-of-n: A alone cannot seat B — the proposal names B and counts nothing until B signs.
    expect(data["counts"]).toBe(false);
    expect((data["awaiting"] as string[]).map((n) => n.toLowerCase())).toContain(contractNym.toLowerCase());
    named = true;
  }, 60_000);

  test("⑩ CONTROL: while the proposal waits, B's put still draws the SAME refusal", async (ctx) => {
    if (!named) ctx.skip();
    const file = join(rootB, "b-edit.mem");
    const r = await B!.cli(["meme", "put", URI, "--bag", "lares", "--file", file, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(false);
    expect(errorOf(said(r))).toBe(errorOf(refusalB));
  }, 60_000);

  test("★ B co-signs, then her `meme put --bag lares` lands on the REALM doc ★", async (ctx) => {
    if (!named) ctx.skip();
    const co = await pollCoSign(120_000);
    console.error(`meme-realm-bag MEASURE B co-sign: ${said(co).trim().slice(0, 300)}`);
    expect(co.json?.["ok"], said(co)).toBe(true);
    expect(((co.json?.["data"] ?? {}) as Record<string, unknown>)["counts"]).toBe(true);

    const base = String(((await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"])).json?.["data"] as Record<string, unknown> | undefined)?.["canonicalHash"] ?? "");
    const file = join(rootB, "b-slot.mem");
    writeFileSync(file, memeWithSlot());
    const put = await B!.cli(["meme", "put", URI, "--bag", "lares", "--base", base, "--file", file, "--json"]);
    console.error(`meme-realm-bag MEASURE B put: ${said(put).trim().slice(0, 300)}`);
    expect(put.json?.["ok"], said(put)).toBe(true);
    bPut = true;
  }, 240_000);

  // ⑪ STANDS. B's placement lands on the registration's own doc and A reads it back — the ford carries one
  // book in both directions.
  //
  // WHERE IT STOPPED, and the wire that names it (`LAR_WIRE_LOG=1` on both daemons, quoted by ⑬ (vi)): the
  // realm leg answers off a STANDING fold, and `writeRealmBagRegistration` keys a record by (bag, signing
  // hand) — so ⑨'s PROPOSAL, written under A's OWN nym, REPLACED A's counted registration. The fold dropped
  // the bag, `RealmBagGate.mayFederate` took its `#standing.has(documentId)` early return, and A's reverdict
  // denied B that document:
  //     [wire] verdict announce peer=<B> doc=<bag> → false
  //     [wire] verdict access   peer=<B> doc=<bag> → false
  // Then B co-signed. Her counted record reached A as a plain CHANGE on the shared realm doc, A's realm plane
  // refolded on that change — and nothing asked the Repo to read the verdict again, so its per-(doc, peer)
  // cache kept answering DENIED. The sync session carried nothing either way after the one crossing.
  // The cure fires the reverdict on EVERY fold (`makeRealmPlane` `onRefold` → `repo.shareConfigChanged`), and
  // the same wire now reads:
  //     [wire] verdict announce peer=<B> doc=<bag> → true
  //     [wire] verdict access   peer=<B> doc=<bag> → true
  //     [wire] out doc=<bag> peer=<B> · [wire] in doc=<bag> peer=<B>
  test("⑪ A's `meme get` reads B's new slot — the write crossed the ford, not a second chest", async (ctx) => {
    if (!bPut) ctx.skip();
    const until = Date.now() + 90_000;
    let text = "";
    while (Date.now() < until) {
      const r = await A!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
      text = String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
      if (text.includes("#/b")) break;
      await new Promise((res) => setTimeout(res, 3_000));
    }
    // B holds her own write whatever A reads — the placement landed, the lane did not open.
    const bGet = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    expect(String((bGet.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? ""), said(bGet)).toContain("#/b");
    expect(text, `A never read B's slot`).toContain("#/b");
  }, 150_000);

  test("⑫ CONTROL: C — never named a steward — still cannot put; and B's STALE base moves nothing", async (ctx) => {
    if (!bPut) ctx.skip();
    const file = join(rootC, "c-edit.mem");
    writeFileSync(file, meme());
    const c = await C!.cli(["meme", "put", URI, "--bag", "lares", "--file", file, "--json"]);
    expect(c.json?.["ok"], said(c)).toBe(false);

    const stale = join(rootB, "b-stale.mem");
    writeFileSync(stale, memeWithSlot("/stale"));
    const r = await B!.cli(["meme", "put", URI, "--bag", "lares", "--base", "0".repeat(64), "--file", stale, "--json"]);
    const decision = String(((r.json?.["data"] ?? {}) as Record<string, unknown>)["decision"] ?? said(r));
    expect(decision, said(r)).toMatch(/conflict/i);
    const after = await A!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    expect(String((after.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).not.toContain("#/stale");
  }, 150_000);

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
  //   (iii) A's VERDICT — the registry pointer A's oracle plane holds for `bags/lares` against the
  //         `docUrl` the standing registration names: one book, or two chests.
  test("⑬ MEASURE: where the return lane stops — A's read, A's replica, or the book's identity", async (ctx) => {
    if (!bPut) ctx.skip();
    const lines: string[] = [];

    // (iii-a) the two doc names, side by side.
    const bags = await A!.cli(["nexus", "realm-bags", "--json"]);
    const regs = ((bags.json?.["data"] as Record<string, unknown> | undefined)?.["bags"] ?? []) as Array<Record<string, unknown>>;
    const registered = String(regs.find((r) => r["bag"] === LARES_BAG)?.["doc"] ?? "");
    const realmDoc = String((bags.json?.["data"] as Record<string, unknown> | undefined)?.["realmDoc"] ?? "");
    const bBags = await B!.cli(["nexus", "realm-bags", "--json"]);
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
    const before = await A!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    const beforeText = String((before.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    const baseA = String((before.json?.["data"] as Record<string, unknown> | undefined)?.["canonicalHash"] ?? "");
    const markerFile = join(A!.root, "a-marker.mem");
    writeFileSync(markerFile, memeWithSlot("/a-marker"));
    const aPut = await A!.cli(["meme", "put", URI, "--bag", "lares", "--base", baseA, "--file", markerFile, "--json"]);
    const after = await A!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    const afterText = String((after.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    const readsOwnWrite = afterText.includes("#/a-marker");
    lines.push(`(ii) A's get carried B's slot before the marker: ${beforeText.includes("#/b")}`);
    lines.push(`(ii) A's own put → ${said(aPut).trim().slice(0, 200)}`);
    lines.push(`(ii) A reads back its OWN write: ${readsOwnWrite} — false means the put door and the get door hold DIFFERENT docs`);

    // (i) A'S REPLICA, OFF DISK. The daemon owns the store while it stands, so it stops first.
    const oracleUrl = bootDocUrl(A!, "oracle");
    await A!.stopDaemonOnly();
    let pointer = "";
    let replicaHasB = "unmeasured";
    let replicaHasMarker = "unmeasured";
    let aRealmTitles: string[] = [];
    let bRealmTitles: string[] = [];
    try {
      const repo = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(A!)) });
      if (oracleUrl) {
        const isle = await repo.find(oracleUrl as never);
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
    const bGet = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
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
    lines.push(`(iii-b) A's oracle registry names ${pointer || "(none)"} for ${LARES_BAG}`);
    lines.push(`(iii-b) registry pointer === registration doc: ${pointer !== "" && pointer === registered}`);
    lines.push(`(i) A's on-disk replica of the registered doc carries B's #/b: ${replicaHasB} · carries A's marker: ${replicaHasMarker}`);
    console.error(`meme-realm-bag ⑬ MEASURE where the lane stops:\n  ${lines.join("\n  ")}`);

    // The measure always reports; it never passes on absence of looking.
    expect(registered, `no standing registration for ${LARES_BAG} — the measure had nothing to read`).not.toBe("");
  }, 180_000);
});
