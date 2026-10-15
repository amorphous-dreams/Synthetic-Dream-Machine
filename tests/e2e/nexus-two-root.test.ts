/**
 * e2e/nexus-two-root — THE TWO-ROOT WITNESS (train N): two operators found one Nexus across two hearths that share
 * nothing but the files a person carries between them.
 *
 * Each hearth stands under its own scratch `LAR_ROOT`, its own port, its own custody and its own daemon, founded by
 * the test door (`vessel found --hearth`); every act runs through the real `lares` CLI against that hearth alone, and
 * the only courier is a directory of files. A one-root shortcut cannot pass: no process here reads both roots.
 *
 *   T1  THE FOUNDING: A opens a cofound offer under a release manifest, B joins typing A's seat fingerprint as heard,
 *       A seals typing B's, B files the inception. Both name ONE joint AID, at threshold two of two.
 *   T2  RED at both imports: the offer, B's half-signed join, a charter with one inception signature stripped and a
 *       charter with none each refuse `seal import --carry` on BOTH hearths, and a plain `seal import` of the stripped
 *       charters refuses on both; CONTROL: the whole charter the cofound filed reads at the joint AID on both.
 *   T3  THE CONTRACTS: each founder consents with its own per-Nexus leaf and opens its own admit; the other vault
 *       judges, cosigns and lands it; the opener lands the completed file. Partials cross as files alone.
 *   T4  INDEPENDENT RESTART: each daemon stops and a fresh one stands the same root; after the unlock, each hearth
 *       reads the same joint AID, its two seats and both founders' admits off its OWN board.
 *   T6  THE ROLL ACROSS TWO ROOTS: each hearth reveals its own cold successor card and mints a fresh one; the circle
 *       crosses as a file (open, join, sign as heard, sign as heard, file, file), the anchor crosses after it and lands
 *       complete on both, and after a second independent restart both hearths read one new head and its two seats.
 *       (An admit made before the roll carries only as a presented lineage through the anchor, never by the board's
 *       own fold at the new head; the node's anchor vectors read that carry.)
 *   T7  A DORMANT ROOT CATCHES UP (N5): a third hearth C carries the charter in and takes a third chair the head
 *       never committed (two of three); that roll's anchor crosses A and B; B goes dormant, its daemon stopped, while
 *       A and C roll on and B's chair passes. B restands one head behind, re-imports the newest charter along the
 *       one lineage (`extended`), reads the head A and C hold, and refuses the charter behind it.
 *   T5  BOTH SEEDS INTACT: each hearth's own household seed charter reads byte-identical to its bytes before the
 *       founding, through every act and restart above.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, stageDir, stopChild, unlockStaged, type CliResult, type LarInstance } from "../harness/instance.js";
import { cidV1Sha256, seatFingerprint } from "../../packages/lararium-mesh/src/index.js";
import { nexusCharterDocPath, parseNexusDoc, renderNexusDoc } from "../../packages/lararium-node/src/nexus-doc.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");

const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const RELEASE = {
  format: "lararium-release-manifest/v1",
  image: { digest: `sha256:${"ab".repeat(32)}`, platforms: ["linux/amd64"] },
  genesis: { seedCid: "5e".repeat(32) }, engine: { cid: cidOf("engine") }, grammar: { cid: cidOf("grammar") },
};

interface Hearth { lar: LarInstance; daemon: ChildProcess | null; log: string }
let A: Hearth;
let B: Hearth;
let C: Hearth | undefined;
let courier = "";
let aid = "";
/** Each founder's cold successor card code, as the staged read-back stand-in answers it (test roots alone). */
const cards = new Map<string, string>();
const seeds = new Map<string, string>();

/** The seal home under one staged root: the household seed's charter rests here, and a carried charter beside it. */
const sealHome = (h: Hearth): string => join(h.lar.root, "data", "lares", "nexus");
const seedBytes = (h: Hearth): string => readFileSync(nexusCharterDocPath(sealHome(h)), "utf8");
const carriedBytes = (h: Hearth): string => readFileSync(nexusCharterDocPath(join(sealHome(h), "carried", aid)), "utf8");
const file = (name: string): string => join(courier, name);
const data = (r: CliResult): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
const firstCard = (r: CliResult): string => String((data(r)["cards"] as Array<{ code: string }>)[0]!.code);
const said = (r: CliResult): string => `rc ${r.code}\n${r.stdout.slice(-600)}\n${r.stderr.slice(-600)}`;

/** Run one CLI act on one hearth and require it to land. */
async function ok(h: Hearth, args: readonly string[]): Promise<CliResult> {
  const r = await h.lar.cli([...args, "--json"]);
  expect(r.code, `${args.join(" ")}: ${said(r)}`).toBe(0);
  return r;
}

/** Run one CLI act on one hearth and require it to refuse. */
async function refused(h: Hearth, args: readonly string[]): Promise<CliResult> {
  const r = await h.lar.cli([...args, "--json"]);
  expect(r.code, `${args.join(" ")} should refuse: ${said(r)}`).not.toBe(0);
  return r;
}

/**
 * Stop a hearth's daemon (its root stays) and stand a FRESH daemon over the same root and port, then unlock it
 * through the test door. Readiness reads off the daemon's own `phase → live` line; the wait counts looks.
 */
async function restand(h: Hearth): Promise<void> {
  if (h.daemon) await stopChild(h.daemon); else await h.lar.stopDaemonOnly();
  h.log = "";
  const d = spawn(process.execPath, [NODE_MAIN, "--root", h.lar.root, "--port", String(h.lar.port)], {
    cwd: NODE_CWD, env: { ...process.env, LAR_ROOT: h.lar.root, LAR_PORT: String(h.lar.port) },
  });
  d.stdout?.on("data", (c) => { h.log += String(c); });
  d.stderr?.on("data", (c) => { h.log += String(c); });
  h.daemon = d;
  await new Promise<void>((resolve, reject) => {
    let looks = 0;
    const poll = setInterval(() => {
      looks += 1;
      if (h.log.includes("phase → live")) { clearInterval(poll); resolve(); }
      else if (d.exitCode !== null) { clearInterval(poll); reject(new Error(`restood daemon exited ${d.exitCode}:\n${h.log.slice(-1200)}`)); }
      else if (looks > 480) { clearInterval(poll); reject(new Error(`restood daemon never reached live:\n${h.log.slice(-1200)}`)); }
    }, 250);
  });
  unlockStaged(h.lar.root);
}

/** One charter text with its genesis inception's signatures cut to the first `keep`. */
function stripped(text: string, keep: number): string {
  const doc = parseNexusDoc(text);
  if (!doc?.sealLineage?.[0]?.inception) throw new Error("the carried charter reads no genesis inception to strip");
  const genesis = doc.sealLineage[0];
  const inception = { ...genesis.inception!, signatures: genesis.inception!.signatures.slice(0, keep) };
  const out = renderNexusDoc({ ...doc, sealLineage: [{ ...genesis, inception }, ...doc.sealLineage.slice(1)] });
  // SETUP TOOK: the stripped charter differs from the whole one.
  expect(out).not.toBe(text);
  return out;
}

beforeAll(async () => {
  courier = mkdtempSync(join(stageDir(), "lares-two-root-courier-"));
  A = { lar: await openStaged({ tag: "two-root-a" }), daemon: null, log: "" };
  B = { lar: await openStaged({ tag: "two-root-b" }), daemon: null, log: "" };
  expect(A.lar.root).not.toBe(B.lar.root);
  for (const h of [A, B]) {
    expect(existsSync(nexusCharterDocPath(sealHome(h))), `no seed charter under ${h.lar.root}`).toBe(true);
    seeds.set(h.lar.root, seedBytes(h));
  }
  writeFileSync(file("release.json"), JSON.stringify(RELEASE));
}, 600_000);

afterAll(async () => {
  for (const h of [A, B, C]) {
    if (!h) continue;
    if (h.daemon) { await stopChild(h.daemon); rmSync(h.lar.root, { recursive: true, force: true }); }
    else await h.lar.stop();
  }
  if (courier) rmSync(courier, { recursive: true, force: true });
});

describe("two hearths found one Nexus with files as the only courier", () => {
  test("T1 — open, join, seal, accept: one joint AID on both hearths", async () => {
    const opened = await ok(A, ["nexus", "seal", "cofound", "open", "--face", "0", "--release", file("release.json"), "--out", file("offer.json")]);
    const aSeat = String(data(opened)["seat"]);
    cards.set(A.lar.root, String((data(opened)["cards"] as Array<{ code: string }>)[0]!.code));
    const joined = await ok(B, ["nexus", "seal", "cofound", "join", file("offer.json"), "--face", "0", "--heard", seatFingerprint(aSeat), "--out", file("join.json")]);
    const bSeat = String(data(joined)["seat"]);
    cards.set(B.lar.root, String((data(joined)["cards"] as Array<{ code: string }>)[0]!.code));
    aid = String(data(joined)["aid"]);
    expect(aid).toMatch(/^nexus-[0-9a-f]{64}$/);
    expect(bSeat).not.toBe(aSeat);
    const sealed = await ok(A, ["nexus", "seal", "cofound", "seal", file("join.json"), "--face", "0", "--heard", seatFingerprint(bSeat), "--out", file("inception.json")]);
    expect(data(sealed)["aid"]).toBe(aid);
  }, 300_000);

  test("T2 — an offer, a half-signed join, and a stripped charter refuse at both imports", async () => {
    // Taken from A, which holds the whole charter; B has not filed the inception yet.
    const whole = carriedBytes(A);
    writeFileSync(file("half.mem"), stripped(whole, 1));
    writeFileSync(file("unsigned.mem"), stripped(whole, 0));
    for (const h of [A, B]) {
      for (const bad of ["offer.json", "join.json", "half.mem", "unsigned.mem"]) {
        await refused(h, ["nexus", "seal", "import", "--carry", file(bad)]);
      }
      for (const bad of ["half.mem", "unsigned.mem"]) await refused(h, ["nexus", "seal", "import", file(bad)]);
    }
    // CONTROL: B files the inception A sealed, and the whole charter stands at the joint AID on both.
    const accepted = await ok(B, ["nexus", "seal", "cofound", "seal", file("inception.json"), "--face", "0"]);
    expect(data(accepted)["aid"]).toBe(aid);
    expect(carriedBytes(B)).toBe(whole);
    for (const h of [A, B]) {
      const read = data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]));
      expect(read["aid"]).toBe(aid);
      expect(read["threshold"]).toBe(2);
      expect(read["seatedKeys"]).toBe(2);
    }
  }, 300_000);

  test("T3 — each founder's admit crosses as files: opened by its own vault, cosigned and landed by the other", async () => {
    const nyms: string[] = [];
    for (const [self, other, tag] of [[A, B, "a"], [B, A, "b"]] as const) {
      const consent = data(await ok(self, ["nexus", "accept-carriage", "--nexus", aid, "--index", "0"]));
      const nym = String(consent["nym"]);
      nyms.push(nym);
      const opened = data(await ok(self, ["nexus", "contract", nym, "--sig", String(consent["contractSig"]), "--nexus", aid, "--out", file(`admit-${tag}-1.json`)]));
      expect(opened["verdict"]).toBe("ready");
      const cosigned = data(await ok(other, ["nexus", "contract", "--from", file(`admit-${tag}-1.json`), "--out", file(`admit-${tag}-2.json`)]));
      expect(cosigned["verdict"]).toBe("complete");
      expect((cosigned["landed"] as { memberHeld?: boolean } | null)?.memberHeld).toBe(true);
      const landed = data(await ok(self, ["nexus", "contract", "--from", file(`admit-${tag}-2.json`)]));
      expect(landed["verdict"]).toBe("complete");
      // A second carry reads replay on the vault that already landed it, and nothing signs.
      await refused(other, ["nexus", "contract", "--from", file(`admit-${tag}-1.json`)]);
    }
    expect(new Set(nyms).size).toBe(2);
    for (const h of [A, B]) {
      expect([...(data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]))["members"] as string[])].sort()).toEqual([...nyms].sort());
    }
  }, 300_000);

  test("T4 — each hearth restarts on its own and reads the joint AID, its seats and both admits off its own board", async () => {
    const before = new Map<string, string[]>();
    for (const h of [A, B]) before.set(h.lar.root, data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]))["members"] as string[]);
    await restand(A);
    await restand(B);
    for (const h of [A, B]) {
      const read = data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]));
      expect(read["aid"]).toBe(aid);
      expect(read["threshold"]).toBe(2);
      expect(read["seatedKeys"]).toBe(2);
      expect(read["members"]).toEqual(before.get(h.lar.root));
      expect((read["members"] as string[]).length).toBe(2);
    }
  }, 600_000);

  test("T6 — the roll crosses both roots with fresh successors, its anchor after, and survives a restart", async () => {
    const before = data(await ok(A, ["nexus", "members", "--list", "--nexus", aid]));
    const opened = await ok(A, ["nexus", "seal", "roll", "open", "--nexus", aid, "--threshold", "2", "--face", "0", "--cold-key", cards.get(A.lar.root)!, "--out", file("circle-1.json")]);
    expect(data(opened)["verdict"]).toBe("ready");
    const joined = await ok(B, ["nexus", "seal", "roll", "join", file("circle-1.json"), "--face", "0", "--cold-key", cards.get(B.lar.root)!, "--out", file("circle-2.json")]);
    expect(data(joined)["chairs"]).toBe(2);
    // Each founder keeps the fresh successor card its contribution printed: the next roll reveals it (T7).
    cards.set(A.lar.root, firstCard(opened));
    cards.set(B.lar.root, firstCard(joined));
    const chairs = JSON.parse(readFileSync(file("circle-2.json"), "utf8"))["chairs"] as Array<{ seat: string }>;
    const aChair = (JSON.parse(readFileSync(file("circle-1.json"), "utf8"))["chairs"] as Array<{ seat: string }>)[0]!.seat;
    const bChair = chairs.find((c) => c.seat !== aChair)!.seat;
    await ok(B, ["nexus", "seal", "roll", "sign", file("circle-2.json"), "--heard-threshold", "2", "--heard", seatFingerprint(aChair), "--out", file("circle-3.json")]);
    const signed = await ok(A, ["nexus", "seal", "roll", "sign", file("circle-3.json"), "--heard-threshold", "2", "--heard", seatFingerprint(bChair), "--out", file("circle-4.json")]);
    expect(data(signed)["verdict"]).toBe("complete");
    for (const h of [A, B]) expect(data(await ok(h, ["nexus", "seal", "roll", "file", file("circle-4.json")]))["outcome"]).toBe("extended");

    // THE ANCHOR crosses after the filed head, as partial files.
    expect(data(await ok(A, ["nexus", "seal", "anchor", "--nexus", aid, "--out", file("anchor-1.json")]))["verdict"]).toBe("ready");
    expect(data(await ok(B, ["nexus", "seal", "anchor", "--from", file("anchor-1.json"), "--out", file("anchor-2.json")]))["verdict"]).toBe("complete");
    expect(data(await ok(A, ["nexus", "seal", "anchor", "--from", file("anchor-2.json")]))["verdict"]).toBe("complete");

    await restand(A);
    await restand(B);
    const heads = new Set<string>();
    for (const h of [A, B]) {
      const read = data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]));
      expect(read["aid"]).toBe(aid);
      expect(read["sealEpochCid"]).not.toBe(before["sealEpochCid"]);
      expect(read["threshold"]).toBe(2);
      expect(read["seatedKeys"]).toBe(2);
      heads.add(String(read["sealEpochCid"]));
    }
    expect(heads.size).toBe(1);
  }, 900_000);

  test("T7 — a dormant root catches up: B sits a roll out, then re-imports the newest charter along the one lineage", async () => {
    C = { lar: await openStaged({ tag: "two-root-c" }), daemon: null, log: "" };
    const head = async (h: Hearth): Promise<string> => String(data(await ok(h, ["nexus", "members", "--list", "--nexus", aid]))["sealEpochCid"]);
    /** The chairs' seats a carried circle file holds, in contribution order. */
    const chairsOf = (name: string): string[] => (JSON.parse(readFileSync(file(name), "utf8"))["chairs"] as Array<{ seat: string }>).map((c) => c.seat);

    // C carries the charter in as a file, at the head A and B hold.
    writeFileSync(file("charter-2.mem"), carriedBytes(A));
    expect(data(await ok(C, ["nexus", "seal", "import", "--carry", file("charter-2.mem")]))["aid"]).toBe(aid);
    expect(await head(C)).toBe(await head(A));

    // THE ADD ROLL: A and B reveal their cards, C takes a chair the head never committed; the rule reads two of three.
    const aOpen = await ok(A, ["nexus", "seal", "roll", "open", "--nexus", aid, "--threshold", "2", "--face", "0", "--cold-key", cards.get(A.lar.root)!, "--out", file("circle-5.json")]);
    const bJoin = await ok(B, ["nexus", "seal", "roll", "join", file("circle-5.json"), "--face", "0", "--cold-key", cards.get(B.lar.root)!, "--out", file("circle-6.json")]);
    const cJoin = await ok(C, ["nexus", "seal", "roll", "join", file("circle-6.json"), "--face", "0", "--added", "--out", file("circle-7.json")]);
    expect(data(bJoin)["chairs"]).toBe(2);
    expect(data(cJoin)["chairs"]).toBe(3);
    const aSeat = chairsOf("circle-5.json")[0]!;
    const bSeat = chairsOf("circle-6.json").find((s) => s !== aSeat)!;
    const cSeat = chairsOf("circle-7.json").find((s) => s !== aSeat && s !== bSeat)!;
    const heard = (own: string): string => [aSeat, bSeat, cSeat].filter((s) => s !== own).map(seatFingerprint).join(",");
    await ok(A, ["nexus", "seal", "roll", "sign", file("circle-7.json"), "--heard-threshold", "2", "--heard", heard(aSeat), "--out", file("circle-8.json")]);
    await ok(B, ["nexus", "seal", "roll", "sign", file("circle-8.json"), "--heard-threshold", "2", "--heard", heard(bSeat), "--out", file("circle-9.json")]);
    expect(data(await ok(C, ["nexus", "seal", "roll", "sign", file("circle-9.json"), "--heard-threshold", "2", "--heard", heard(cSeat), "--out", file("circle-10.json")]))["verdict"]).toBe("complete");
    for (const h of [A, B, C]) expect(data(await ok(h, ["nexus", "seal", "roll", "file", file("circle-10.json")]))["outcome"]).toBe("extended");
    const added = await head(A);
    for (const h of [B, C]) expect(await head(h)).toBe(added);
    writeFileSync(file("charter-3.mem"), carriedBytes(A));
    // The add roll's anchor crosses A and B, whose boards hold the same acts; the next roll waits on it.
    expect(data(await ok(A, ["nexus", "seal", "anchor", "--nexus", aid, "--out", file("anchor-3.json")]))["verdict"]).toBe("ready");
    expect(data(await ok(B, ["nexus", "seal", "anchor", "--from", file("anchor-3.json"), "--out", file("anchor-4.json")]))["verdict"]).toBe("complete");
    expect(data(await ok(A, ["nexus", "seal", "anchor", "--from", file("anchor-4.json")]))["verdict"]).toBe("complete");

    // B GOES DORMANT: its daemon stops, and A and C roll on without it; B's chair passes.
    if (B.daemon) await stopChild(B.daemon); else await B.lar.stopDaemonOnly();
    await ok(A, ["nexus", "seal", "roll", "open", "--nexus", aid, "--threshold", "2", "--face", "0", "--cold-key", firstCard(aOpen), "--out", file("circle-11.json")]);
    await ok(C, ["nexus", "seal", "roll", "join", file("circle-11.json"), "--face", "0", "--cold-key", firstCard(cJoin), "--out", file("circle-12.json")]);
    const aPass = chairsOf("circle-11.json")[0]!;
    const cPass = chairsOf("circle-12.json").find((s) => s !== aPass)!;
    await ok(A, ["nexus", "seal", "roll", "sign", file("circle-12.json"), "--heard-threshold", "2", "--heard", seatFingerprint(cPass), "--out", file("circle-13.json")]);
    expect(data(await ok(C, ["nexus", "seal", "roll", "sign", file("circle-13.json"), "--heard-threshold", "2", "--heard", seatFingerprint(aPass), "--out", file("circle-14.json")]))["verdict"]).toBe("complete");
    for (const h of [A, C]) expect(data(await ok(h, ["nexus", "seal", "roll", "file", file("circle-14.json")]))["outcome"]).toBe("extended");
    const passed = await head(A);
    expect(await head(C)).toBe(passed);
    expect(passed).not.toBe(added);

    // B WAKES one head behind. A charter it already passed refuses; the newest extends along the one lineage.
    await restand(B);
    expect(await head(B)).toBe(added);
    writeFileSync(file("charter-4.mem"), carriedBytes(A));
    const caught = data(await ok(B, ["nexus", "seal", "import", "--carry", file("charter-4.mem")]));
    expect(caught["outcome"]).toBe("extended");
    expect(caught["epoch"]).toBe(passed);
    expect(await head(B)).toBe(passed);
    await refused(B, ["nexus", "seal", "import", "--carry", file("charter-3.mem")]);
    expect(data(await ok(B, ["nexus", "seal", "import", "--carry", file("charter-4.mem")]))["outcome"]).toBe("same");
    // The head B caught up to seats A's and C's chairs alone, at the rule they rolled.
    const read = data(await ok(B, ["nexus", "members", "--list", "--nexus", aid]));
    expect(read["threshold"]).toBe(2);
    expect(read["seatedKeys"]).toBe(2);
  }, 1_200_000);

  test("T5 — both household seeds stand byte-identical", () => {
    for (const h of [A, B]) expect(seedBytes(h)).toBe(seeds.get(h.lar.root));
    expect(seeds.get(A.lar.root)).not.toBe(seeds.get(B.lar.root));
  });
});
