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
 * contract writes the carriage-contracts board and never a bag, and B answers `not-found`. The vector holds
 * as `test.fails`, GATED on the contract having landed — a refusal at a relation door skips the vector
 * rather than reading as the seam. The day the realm carries the bag (realm-bag-brief#/what-the-realm-holds
 * names the five seams), this reads "expected to fail" and the hold retires.
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
let rootB = "";
/** The relation's doors, as they answered — the gate on the vector. */
let contracted = false;
let doors = "";

describe.skipIf(gaps.length > 0)("★ a bag two operators keep through a relation ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-Bop-"));
    const portA = await freePort();
    const portB = await freePort();
    A = await openStaged({ tag: "A", port: portA, found: async (cliA, rootA) => {
      const clear = await cliA(["vessel", "clear", "--root", rootA, "--force"]);
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
    // B: its OWN root, its own founding — a second OPERATOR, never a device of A's.
    B = await openStaged({ tag: "B", root: rootB, port: portB, found: async (cliB, root) => {
      const clear = await cliB(["vessel", "clear", "--root", root, "--force"]);
      if (clear.code !== 0) throw new Error(`B: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cliB(["persona", "new", "0", "--name", "highland-steward"]);
      if (face.code !== 0) throw new Error(`B: face failed (${face.code})\n${face.stderr.slice(-800)}`);
    }, daemonEnv: { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA } });
    if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);

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
        const contract = await A.cli(["nexus", "contract", acc.nym, "--sig", acc.contractSig, "--json"]);
        lines.push(`A nexus contract → ${contract.code}: ${said(contract).trim().slice(0, 240)}`);
        contracted = contract.code === 0;
        const refresh = await B.cli(["nexus", "refresh", "--json"]);
        lines.push(`B nexus refresh → ${refresh.code}`);
      }
    }
    doors = lines.join("\n  ");
    console.error(`meme-realm-bag MEASURE the relation's doors:\n  ${doors}`);
  }, 400_000);

  afterAll(async () => {
    if (B) await B.stop();
    if (A) await A.stop();
    if (rootB && existsSync(rootB)) rmSync(rootB, { recursive: true, force: true });
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
  });

  // THE SEAM. A contracted operator holding the relation does not hold the bag: each vessel mints its own
  // `bags/lares` doc, nothing registers a realm-scoped bag in a CRDT both replicate, and B's third reach
  // (`meme-verbs.ts:136-143`, reach-by-access) finds no doc. Gated on the contract: a refusal at a door above
  // is reported by ③ and never counted as this seam.
  test.fails("★ B's `meme get --bag lares` answers through the realm ★ (SEAM — no realm bag registers today)", async (ctx) => {
    if (!contracted) ctx.skip();   // the gate reads at RUN time — a refused door skips, never a red for the wrong reason
    const r = await B!.cli(["meme", "get", URI, "--bag", "lares", "--json"]);
    console.error(`meme-realm-bag MEASURE B: meme get --bag lares → ${said(r).trim().slice(0, 300)}`);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(String((r.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).toContain('bag = "salt: 12');
  }, 60_000);
});
