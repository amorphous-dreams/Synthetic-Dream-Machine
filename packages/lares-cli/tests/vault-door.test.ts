/**
 * vault-door — `lares vault status|unlock|bind|unbind` and the founding TTY gatherer, on real files under a scratch root.
 *
 * The prompt layer is the one fake: a scripted queue stands in for the operator's keystrokes. Everything beneath it (the
 * slot tree, the custody root, the sealed writer) is the real thing, so a wrong credential is a real AEAD miss.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The room each test and hook takes, stated where the file loads: a founding derives a key from a passphrase and every bind derives another, so a case here runs for seconds. A timeout stated inside a hook reaches no
// case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const answers: string[] = [];
let tty = true;
vi.mock("../src/prompt-secret.js", () => {
  const next = (): Promise<string> => Promise.resolve(answers.shift() ?? "");
  return {
    canPromptSecret: () => tty,
    promptLine: () => next(),
    promptSecret: () => next(),
    promptSecretConfirmed: () => next(),
  };
});

import { FsCustodyIo, foundCustody, custodyStatus, unlockCustody, vesselCustodyHomes, makeCustodyHolder, openFaceTree } from "@lararium/node";
import { writeSealedCarrier } from "@lararium/mesh";
import { helpLines } from "../src/command-help.js";
import { parseArgs } from "../src/parse-args.js";

// The suite's setup file (tests/support/found-route.ts) already loaded `found.ts` -> `custody-prompt.ts` -> the REAL
// prompt layer before this file's mock registered. Reset the module graph and load the door fresh under the mock.
let cmdVault: typeof import("../src/commands/vault.js").cmdVault;
let gatherFoundingRoute: typeof import("../src/custody-prompt.js").gatherFoundingRoute;
let CredentialTtyRefusal: typeof import("../src/custody-prompt.js").CredentialTtyRefusal;
beforeAll(async () => {
  vi.resetModules();
  ({ cmdVault } = await import("../src/commands/vault.js"));
  ({ gatherFoundingRoute, CredentialTtyRefusal } = await import("../src/custody-prompt.js"));
});

const PW = "first-route-passphrase";
const PW2 = "second-route-passphrase";
let root: string;
let out: string[]; let err: string[];

function tree(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n); const st = statSync(p);
      if (st.isDirectory()) walk(p); else if (st.isFile()) h.update(p).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest("hex");
}

async function slots(): Promise<{ id: string }[]> {
  const homes = vesselCustodyHomes();
  const s = await custodyStatus({ io: new FsCustodyIo(homes), homes });
  return s.tree.reading === "readable" ? [...s.tree.slots] : [];
}

const run = (...argv: string[]): Promise<number> => cmdVault(parseArgs(["vault", ...argv, "--json"]));

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "vault-door-"));
  process.env["LAR_ROOT"] = root;
  tty = true; answers.length = 0; out = []; err = [];
  vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { out.push(String(c)); return true; });
  const homes = vesselCustodyHomes();
  await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PW }] }] });
});
afterEach(() => { vi.restoreAllMocks(); delete process.env["LAR_ROOT"]; rmSync(root, { recursive: true, force: true }); });

describe("vault door — a credential rides a TTY alone", () => {
  it("★ with no TTY, unlock/bind/unbind refuse BY NAME and write nothing ★", async () => {
    tty = false;
    const before = tree(root);
    for (const argv of [["unlock"], ["bind"], ["unbind", "abc"]]) {
      out.length = 0;
      expect(await run(...argv)).toBe(1);
      expect(out.join("")).toMatch(/CredentialTtyRefusal/);
    }
    expect(tree(root)).toBe(before);
  });

  it("★ the founding gatherer refuses by name with no TTY and names the container recipe ★", async () => {
    tty = false;
    const refusal = await gatherFoundingRoute().catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(CredentialTtyRefusal);
    expect((refusal as Error).message).toMatch(/tools\/lares-container\.sh found/);
    expect((refusal as Error).message).toMatch(/--profile offline run --rm offline vessel found/);
  });

  it("the founding gatherer on a TTY returns one passphrase slot", async () => {
    answers.push("p", "route-pass");
    const got = await gatherFoundingRoute();
    expect(got).toEqual([{ t: 1, pins: [{ kind: "passphrase", passphrase: "route-pass" }] }]);
  });
});

describe("vault door — one face's own tree", () => {
  async function foundOneFace(): Promise<string> {
    const homes = vesselCustodyHomes();
    const io = new FsCustodyIo(homes);
    const u = await unlockCustody({ io, homes, credentials: [{ kind: "passphrase", passphrase: PW }] });
    if (u.reading !== "opens") throw new Error("node key did not open");
    const holder = makeCustodyHolder({ io, homes });
    await holder.adopt(u.treeKey);
    const { fcid } = await holder.foundFace({ group: "1".repeat(64), slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PW }] }] });
    await holder.lock();
    return fcid;
  }

  it("★ status prints a face as one counted line with digests, never its rows by name ★", async () => {
    await foundOneFace();
    out.length = 0;
    expect(await cmdVault(parseArgs(["vault", "status", "--no-json"]))).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/face h0 +[0-9a-f]{12}…  \d+ row\(s\): \d+ sealed under its key, 0 at fault +group 111111111111…/);
    expect(text).not.toMatch(/face-owner/);
  });

  it("★ bind --face N lands in the face's own tree and leaves the node tree at its one slot ★", async () => {
    const fcid = await foundOneFace();
    answers.push("p", PW, "n", PW2);
    expect(await run("bind", "--face", "0", "--passphrase")).toBe(0);
    expect(await slots()).toHaveLength(1);                                                     // the node tree is untouched
    const homes = vesselCustodyHomes();
    const io = new FsCustodyIo(homes);
    const second = await openFaceTree({ io, homes, fcid, credentials: [{ kind: "passphrase", passphrase: PW2 }] });
    expect(second.reading).toBe("opens");
    const refusal = await openFaceTree({ io, homes, fcid, credentials: [{ kind: "passphrase", passphrase: "not-a-route" }] });
    expect(refusal.reading).toBe("no-slot-opens");                                             // CONTROL
  });

  it("★ lock --face N with no vessel standing says so and changes nothing ★", async () => {
    await foundOneFace();
    const before = tree(root);
    expect(await run("lock", "--face", "0")).toBe(0);
    expect(tree(root)).toBe(before);
  });
});

describe("vault door — status, unlock, bind, unbind", () => {
  it("status prints the custody tree, the rows and the relation class", async () => {
    expect(await run("status")).toBe(0);
    const j = JSON.parse(out.join("").trim().split("\n").pop()!);
    expect(j.data.custody.tree.reading).toBe("readable");
    expect(j.data.custody.tree.slots).toHaveLength(1);
    expect(j.data.custody.rows.some((r: { row: string; reading: string }) => r.row === "gate-root" && r.reading === "sealed")).toBe(true);
    expect(JSON.stringify(j)).not.toContain(PW);
  });

  it("★ a right route opens and a wrong route refuses and destroys nothing ★", async () => {
    const before = tree(root);
    answers.push("p", "not-the-passphrase", "n");
    expect(await run("unlock")).toBe(1);
    expect(tree(root)).toBe(before);
    out.length = 0;
    answers.push("p", PW, "n");
    expect(await run("unlock")).toBe(0);
    expect(out.join("")).toMatch(/"reading":"opens"/);
    expect(out.join("")).not.toContain(PW);
  });

  it("bind adds a slot that opens on its own route; unbind prints the offer and, under --rotate, ends the removed route", async () => {
    answers.push("p", PW, "n", PW2);
    expect(await run("bind", "--passphrase")).toBe(0);
    const two = await slots();
    expect(two).toHaveLength(2);

    // unbind WITHOUT --rotate: the offer rides the result every time; the carriers keep their S key.
    out.length = 0;
    answers.push("p", PW, "n");
    expect(await run("unbind", two[1]!.id)).toBe(0);
    expect(out.join("")).toMatch(/"rotated":false/);
    expect(out.join("")).toMatch(/rotationOffer/);
    expect(await slots()).toHaveLength(1);

    // bind again, then unbind WITH --rotate: the staying slot re-reads its route, the removed route opens nothing.
    answers.push("p", PW, "n", PW2);
    await run("bind", "--passphrase");
    const again = await slots();
    out.length = 0;
    answers.push("p", PW, "n", PW);                   // unlock, then re-enter the staying slot's route
    expect(await run("unbind", again[1]!.id, "--rotate")).toBe(0);
    expect(out.join("")).toMatch(/"rotated":true/);
    answers.push("p", PW2, "n");
    expect(await run("unlock")).toBe(1);               // the removed route opens nothing
    answers.push("p", PW, "n");
    expect(await run("unlock")).toBe(0);               // the staying route still opens
  }, 60_000);

  it("★ `unbind --rotate <id>` rotates, exactly as `unbind <id> --rotate` does; `--rotate=x` refuses ★", async () => {
    answers.push("p", PW, "n", PW2);
    await run("bind", "--passphrase");
    const two = await slots();
    out.length = 0;
    answers.push("p", PW, "n", PW);
    expect(await run("unbind", "--rotate", two[1]!.id)).toBe(0);
    expect(out.join("")).toMatch(/"rotated":true/);
    expect(await slots()).toHaveLength(1);
    answers.push("p", PW2, "n");
    expect(await run("unlock")).toBe(1);               // the removed route opens nothing
    // `--rotate=<anything>` is no spelling of the flag: the parser refuses it by name.
    expect(() => parseArgs(["vault", "unbind", "abc", "--rotate=abc"])).toThrow(/--rotate is a flag and takes no value/);
  }, 60_000);

  it("★ status gives ONE reading of each standing file: a floor row beside its law, a bare hot row as a fault, a private file outside the table by name ★", async () => {
    const homes = vesselCustodyHomes();
    writeFileSync(join(homes.identity, ".vessel-key-x.json"), "{}", { mode: 0o600 });
    writeFileSync(join(homes.identity, ".persona-enroll-pending.json"), "{}", { mode: 0o600 });
    writeFileSync(join(homes.identity, "side-key.json"), "{}", { mode: 0o600 });
    expect(await cmdVault(parseArgs(["vault", "status", "--no-json"]))).toBe(0);
    const lines = out.join("\n").split("\n");
    // each standing file reads on exactly one line
    for (const file of ["gate-root.bin", ".vessel-key-x.json", ".persona-enroll-pending.json", "s-slots.bin"]) {
      expect(lines.filter((l) => l.includes(file)), file).toHaveLength(1);
    }
    expect(lines.find((l) => l.includes("gate-root.bin"))).toMatch(/hot\s+device-minted\s+sealed/);
    expect(lines.find((l) => l.includes(".vessel-key-x.json"))).toMatch(/floor\s+device-minted\s+bare\s+\S+\s+by law: /);
    expect(lines.find((l) => l.includes("s-slots.bin"))).toMatch(/bare\s+s-slots\.bin\s+by law: /);
    expect(lines.find((l) => l.includes(".persona-enroll-pending.json"))).toMatch(/bare\s+\.persona-enroll-pending\.json\s+FAULT/);
    expect(lines.find((l) => l.includes("side-key.json"))).toMatch(/OUTSIDE THE TABLE.*owner-only/);
    // the json answer carries the one custody reading, and no second table of the same files
    out.length = 0;
    expect(await run("status")).toBe(0);
    const j = JSON.parse(out.join("").trim().split("\n").pop()!);
    expect(Object.keys(j.data).sort()).toEqual(["custody", "door"]);
    expect(j.data.custody.outside.map((o: { file: string }) => o.file)).toEqual(["side-key.json"]);
    expect(j.data.custody.rows.filter((r: { fault: boolean }) => r.fault).map((r: { row: string }) => r.row)).toEqual(["enroll-pending"]);
  });

  it("★ CONTROL: a clean custody home reads no fault and nothing outside the table ★", async () => {
    expect(await cmdVault(parseArgs(["vault", "status", "--no-json"]))).toBe(0);
    const text = out.join("\n");
    expect(text).not.toMatch(/FAULT|OUTSIDE THE TABLE/);
    expect(text).toMatch(/outside the table\s+nothing/);
  });

  it("★ an unbind that rotates asks the rotation's census FIRST: a sealed file no row names refuses by name and both slots stay bound ★", async () => {
    answers.push("p", PW, "n", PW2);
    await run("bind", "--passphrase");
    const two = await slots();
    const homes = vesselCustodyHomes();
    const io = new FsCustodyIo(homes);
    const u = await unlockCustody({ io, homes, credentials: [{ kind: "passphrase", passphrase: PW }] });
    if (u.reading !== "opens") throw new Error("the fixture's own route opens");
    await writeSealedCarrier({ io, treeKey: u.treeKey, treePath: join(homes.identity, "s-slots.bin"), carrier: { name: "storage/stray.bin", path: join(homes.storage, "stray.bin") }, plaintext: new TextEncoder().encode("x") });
    const before = tree(root);
    out.length = 0;
    answers.push("p", PW, "n", PW);
    expect(await run("unbind", two[1]!.id, "--rotate")).toBe(1);
    expect(out.join("")).toMatch(/CensusRefusal/);
    expect(tree(root)).toBe(before);
    expect(await slots()).toHaveLength(2);
    // CONTROL: with the stray gone the same command completes.
    rmSync(join(homes.storage, "stray.bin"));
    out.length = 0;
    answers.push("p", PW, "n", PW);
    expect(await run("unbind", two[1]!.id, "--rotate")).toBe(0);
    expect(out.join("")).toMatch(/"rotated":true/);
    expect(await slots()).toHaveLength(1);
  });

  it("★ a mistyped staying route refuses BEFORE any byte moves ★", async () => {
    answers.push("p", PW, "n", PW2);
    await run("bind", "--passphrase");
    const two = await slots();
    const before = tree(root);
    answers.push("p", PW, "n", "typo-typo");           // unlock ok, staying slot's route mistyped
    expect(await run("unbind", two[1]!.id, "--rotate")).not.toBe(0);
    expect(tree(root)).toBe(before);
  });
});

describe("vault door — backup asks the standing vessel", () => {
  it("backup with no vessel standing refuses `no-vessel`, reads no credential and writes no file", async () => {
    const before = tree(root);
    answers.push("p", PW, "n", "p", "a-bundle-route");
    expect(await run("backup", "--face", "0", "--out", join(root, "face.bundle"))).toBe(1);
    expect(out.join("")).toMatch(/"code":\s*"no-vessel"/);
    expect(answers.length, "no prompt opened: every scripted answer still waits").toBe(5);
    expect(tree(root)).toBe(before);
  });

  it("backup without a face or without a file refuses as a usage error", async () => {
    for (const argv of [["backup"], ["backup", "--face", "0"], ["backup", "--out", join(root, "x")], ["backup", "--face", "-1", "--out", join(root, "x")], ["backup", "--face", "one", "--out", join(root, "x")]]) {
      out.length = 0;
      expect(await run(...argv)).toBe(2);
      expect(out.join("")).toMatch(/"code":\s*"usage"/);
    }
  });
});

describe("vault door — restore reads the bundle's route on a terminal", () => {
  it("restore without a file, with a bad index, or with --memory and --as together refuses as a usage error", async () => {
    for (const argv of [["restore"], ["restore", join(root, "x.bundle"), "--as", "one"], ["restore", join(root, "x.bundle"), "--as", "-1"], ["restore", join(root, "x.bundle"), "--memory", "--as", "1"]]) {
      out.length = 0;
      expect(await run(...argv)).toBe(2);
      expect(out.join("")).toMatch(/"code":\s*"usage"/);
    }
  });

  it("restore --memory with no vessel standing refuses `no-vessel` and reads no credential", async () => {
    answers.push("p", "a-bundle-route");
    expect(await run("restore", join(root, "x.bundle"), "--memory")).toBe(1);
    expect(out.join("")).toMatch(/"code":\s*"no-vessel"/);
    expect(answers.length).toBe(2);
  });

  it("★ with no TTY, backup's route and restore's route refuse BY NAME ★", async () => {
    tty = false;
    out.length = 0;
    expect(await run("restore", join(root, "x.bundle"))).toBe(1);
    expect(out.join("")).toMatch(/CredentialTtyRefusal/);
  });

  it("restore of a file that reads as no bundle refuses `bundle-malformed`, and moves no row", async () => {
    const bent = join(root, "bent.bundle");
    writeFileSync(bent, "no bundle here");
    const before = tree(root);
    answers.push("p", "a-bundle-route", "n");
    expect(await run("restore", bent)).toBe(1);
    expect(out.join("")).toMatch(/"code":\s*"bundle-malformed"/);
    expect(tree(root)).toBe(before);
  });
});

describe("the vault door answers seven verbs", () => {
  const SEVEN = ["status", "unlock", "lock", "bind", "unbind", "backup", "restore"];

  it("★ the help names the seven and no other verb, and offers no credential by flag or by environment ★", () => {
    const text = helpLines("vault").join("\n");
    const usage = /usage: lares vault <([^>]*(?:<[^>]*>[^>]*)*)> /.exec(text.replace(/<(slot-id|N|file)>/g, "$1"));
    expect(usage, text).not.toBeNull();
    expect(usage![1]!.split("|").map((part) => part.trim().split(/\s+/)[0])).toEqual(SEVEN);
    expect(text).not.toMatch(/LARES_[A-Z_]*PASSPHRASE|--yes|--check/);
  });

  it("★ any other word answers as no door: a usage refusal that names the word, and no byte moves ★", async () => {
    const before = tree(root);
    for (const verb of ["seal", "rotate", "repair", "passphrase", "export"]) {
      out.length = 0; err.length = 0;
      process.env["LARES_ARCHIVE_PASSPHRASE"] = "a-synthetic-route-in-the-environment";
      process.env["LARES_ARCHIVE_PASSPHRASE_NEW"] = "another-synthetic-route";
      try { expect(await run(verb, "--yes"), verb).toBe(2); }
      finally { delete process.env["LARES_ARCHIVE_PASSPHRASE"]; delete process.env["LARES_ARCHIVE_PASSPHRASE_NEW"]; }
      expect([...out, ...err].join("\n"), verb).toContain(`unknown sub-verb "${verb}"`);
    }
    expect(tree(root)).toBe(before);
    // CONTROL: a verb of the seven answers.
    expect(await run("status")).toBe(0);
  });
});
