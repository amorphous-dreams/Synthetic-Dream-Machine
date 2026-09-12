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
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, freePort, stageDir, awaitRendezvous, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t.witness.ford/ledger";
const URI  = `lar:///${PATH}`;
const LARES_BAG = "lar:///ha.ka.ba/bags/lares";
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

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

describe.skipIf(gaps.length > 0)("★ a bag two operators keep through a relation ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-Bop-"));
    rootC = mkdtempSync(join(stageDir(), "lares-staged-Cop-"));
    const portA = await freePort();
    const portB = await freePort();
    const portC = await freePort();
    A = await openStaged({ tag: "A", port: portA, found: async (cliA, rootA) => {
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
    const dialA = { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA };
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
      acc = { nym: typeof data["nym"] === "string" ? data["nym"] : undefined, contractSig: typeof data["contractSig"] === "string" ? data["contractSig"] : undefined };
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
    expect(String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).toContain('bag = "salt: 12');
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
    const errorOf = (text: string): string => JSON.stringify((JSON.parse(text.split("\n").find((l) => l.startsWith("{")) ?? "{}") as Record<string, unknown>)["error"] ?? null);
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
  }, 60_000);
});
