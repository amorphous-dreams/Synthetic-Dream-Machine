/**
 * e2e/realm-select — MANY REALMS UNDER ONE NEXUS, and a verb that names its realm.
 *
 * One operator founds a hearth and seats a charter, so the vessel stands its charter-derived realm. It then ACTS
 * in a cabal realm R (a 64-hex name): it registers a bag there, sealed by the key its worn face presents to the
 * Nexus. The law (`cabal-realm#/many-realms`):
 *
 *   · a verb names its realm (`--realm <id>`), and with none named it routes to the charter-derived realm;
 *   · a write to one realm never appears in another's plane;
 *   · an act stands the vessel in a realm, and a read never does;
 *   · a verb that names a realm reads that realm alone.
 *
 * THE VECTOR: the bag registered in R lists under `realm-bags --realm R`; `meme get
 * --bag lares --realm R` answers through R's registration. CONTROLS: the charter-derived and R listings each
 * hold their own record, while the unscoped listing names both stood realms; a
 * realm the vessel never entered reads empty, answers `not-found`, and stays unentered.
 *
 * One vessel only: a cabal realm's documents cross between two operators once the realm's member consult
 * answers for a peer, which waits on the wire train (`cabal-realm#/many-realms`, OWED).
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, awaitRendezvous, foundStagedHearth, freePort, growStagedQuorum, type LarInstance } from "../harness/instance.js";
import { seedUserBag } from "../harness/promote.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t.witness.realms/minutes";
const URI  = `lar:///${PATH}`;
const LARES_BAG = "lar:///ha.ka.ba/bags/ford";   // a user bag: system canon rests in the Kahu realm, never a relation's
const REALM_R = "c1ab".repeat(16);          // the book club's realm
const REALM_NEVER = "0ddba11".padEnd(64, "0");   // a realm this vessel never enters
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const meme = (): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n<<~ ahu #/minutes>>\n\n! the minutes\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds a vessel");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`realm-select: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let charterRealm = "";
const dataOf = (r: { json: Record<string, unknown> | null }): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
const bagsOf = (r: { json: Record<string, unknown> | null }): string[] =>
  ((dataOf(r)["bags"] ?? []) as Array<Record<string, unknown>>).map((b) => String(b["bag"]));
/** The bags a listing names, minus the live system canon the Kahu realm (the charter-derived realm) always lists. */
const userBagsOf = (r: { json: Record<string, unknown> | null }): string[] =>
  bagsOf(r).filter((bag) => bag !== "lar:///ha.ka.ba/bags/lares" && bag !== "lar:///ha.ka.ba/bags/lararium");
const rowsOf = (r: { json: Record<string, unknown> | null }): Array<Record<string, unknown>> =>
  (dataOf(r)["bags"] ?? []) as Array<Record<string, unknown>>;

describe.skipIf(gaps.length > 0)("★ many realms under one Nexus — a verb names its realm ★", () => {
  beforeAll(async () => {
    A = await openStaged({ tag: "realms", port: await freePort(), found: async (cli, root) => {
      await foundStagedHearth(cli, root, "club-keeper");
      const wear = await cli(["persona", "wear", "0"]);
      if (wear.code !== 0) throw new Error(`persona wear 0 failed (${wear.code})\n${wear.stderr.slice(-800)}`);
      await growStagedQuorum(cli, root, ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`the vessel reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
  }, 400_000);

  afterAll(async () => { if (A) await A.stop(); });

  test("① the vessel stands its charter-derived realm alone, and holds a meme in its own user bag", async () => {
    const list = await A!.cli(["nexus", "realm-bags", "--json"]);
    expect(list.json?.["ok"], said(list)).toBe(true);
    charterRealm = String(dataOf(list)["realm"] ?? "");
    expect(charterRealm.length).toBeGreaterThan(0);
    expect(dataOf(list)["realms"]).toEqual([charterRealm]);
    // The live system canon rests in the Kahu realm, which IS the charter-derived realm: it lists `lares` and `lararium`
    // beside any user bag. The relation here keeps a user bag.
    expect(bagsOf(list)).toEqual(expect.arrayContaining(["lar:///ha.ka.ba/bags/lares", "lar:///ha.ka.ba/bags/lararium"]));
    const mint = await A!.cli(["act", "CREATE", "--bag", LARES_BAG, "--yes", "--json"]);
    expect(mint.json?.["ok"], said(mint)).toBe(true);
    const file = join(A!.root, "realms-stage-minutes.mem");
    writeFileSync(file, meme());
    await seedUserBag(A!, file, LARES_BAG);
  }, 120_000);

  test("② CONTROL (before): the realm nobody entered reads empty, and the read enters nothing", async () => {
    const list = await A!.cli(["nexus", "realm-bags", "--realm", REALM_R, "--json"]);
    expect(list.json?.["ok"], said(list)).toBe(true);
    expect(bagsOf(list)).toEqual([]);
    expect(dataOf(list)["realmDoc"]).toBeNull();
    expect(dataOf(list)["realms"]).toEqual([charterRealm]);
    const got = await A!.cli(["meme", "get", URI, "--bag", "ford", "--realm", REALM_R, "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(false);
  }, 60_000);

  test("★ a bag registered in realm R lists in R and in no other realm ★", async () => {
    const reg = await A!.cli(["nexus", "realm-bag", "ford", "--realm", REALM_R, "--json"]);
    console.error(`realm-select MEASURE register in R: ${said(reg).trim().slice(0, 300)}`);
    expect(reg.json?.["ok"], said(reg)).toBe(true);
    expect(dataOf(reg)["realm"]).toBe(REALM_R);
    expect(dataOf(reg)["counts"]).toBe(true);
    const inR = await A!.cli(["nexus", "realm-bags", "--realm", REALM_R, "--json"]);
    expect(bagsOf(inR)).toEqual([LARES_BAG]);
    expect(dataOf(inR)["realm"]).toBe(REALM_R);
    expect((dataOf(inR)["realms"] as string[]).sort()).toEqual([charterRealm, REALM_R].sort());
    // THE RED: the charter-derived realm's plane holds nothing of it.
    const inDefault = await A!.cli(["nexus", "realm-bags", "--realm", charterRealm, "--json"]);
    expect(dataOf(inDefault)["realm"]).toBe(charterRealm);
    expect(userBagsOf(inDefault)).toEqual([]);
    const elsewhere = await A!.cli(["nexus", "realm-bags", "--realm", REALM_NEVER, "--json"]);
    expect(bagsOf(elsewhere)).toEqual([]);
    expect((dataOf(elsewhere)["realms"] as string[])).not.toContain(REALM_NEVER);      // a read never enters
  }, 120_000);

  test("★ `meme get --bag lares --realm R` answers through R's registration, and no other realm's ★", async () => {
    const until = Date.now() + 60_000;
    let got = await A!.cli(["meme", "get", URI, "--bag", "ford", "--realm", REALM_R, "--json"]);
    while (got.json?.["ok"] !== true && Date.now() < until) {
      await new Promise((res) => setTimeout(res, 3_000));
      got = await A!.cli(["meme", "get", URI, "--bag", "ford", "--realm", REALM_R, "--json"]);
    }
    expect(got.json?.["ok"], said(got)).toBe(true);
    expect(String(dataOf(got)["text"] ?? "")).toContain("#/minutes");
    const never = await A!.cli(["meme", "get", URI, "--bag", "ford", "--realm", REALM_NEVER, "--json"]);
    expect(never.json?.["ok"], said(never)).toBe(false);
    // `--realm` names a bag's realm, never a wiki's.
    const both = await A!.cli(["meme", "get", URI, "--recipe", "lares", "--realm", REALM_R, "--json"]);
    expect(both.json?.["ok"], said(both)).toBe(false);
    expect(said(both)).toContain("no-container");
  }, 120_000);

  test("③ CONTROL: with no realm named, a verb routes to the charter-derived realm, and each realm keeps its own record", async () => {
    const reg = await A!.cli(["nexus", "realm-bag", "ford", "--json"]);
    expect(reg.json?.["ok"], said(reg)).toBe(true);
    expect(dataOf(reg)["realm"]).toBe(charterRealm);
    expect(userBagsOf(await A!.cli(["nexus", "realm-bags", "--realm", charterRealm, "--json"]))).toEqual([LARES_BAG]);
    expect(bagsOf(await A!.cli(["nexus", "realm-bags", "--realm", REALM_R, "--json"]))).toEqual([LARES_BAG]);
    const unscoped = await A!.cli(["nexus", "realm-bags", "--json"]);
    const rows = rowsOf(unscoped).filter((row) => row["bag"] === LARES_BAG);
    expect(rows.map((row) => row["realm"]).sort()).toEqual([charterRealm, REALM_R].sort());
    expect(rows.every((row) => typeof row["realm"] === "string")).toBe(true);
    expect(rows.map((row) => row["bag"])).toEqual([LARES_BAG, LARES_BAG]);
    // A name that reads as no realm refuses by name.
    const bad = await A!.cli(["nexus", "realm-bag", "ford", "--realm", "not-a-realm", "--json"]);
    expect(bad.json?.["ok"], said(bad)).toBe(false);
    expect(said(bad)).toContain("realm-unreadable");
  }, 120_000);
});
