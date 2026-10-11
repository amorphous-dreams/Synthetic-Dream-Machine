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

import { FsCustodyIo, foundCustody, custodyStatus, vesselCustodyHomes } from "@lararium/node";
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
    expect((refusal as Error).message).toMatch(/docker compose run --rm -it found/);
  });

  it("the founding gatherer on a TTY returns one passphrase slot", async () => {
    answers.push("p", "route-pass");
    const got = await gatherFoundingRoute();
    expect(got).toEqual([{ t: 1, pins: [{ kind: "passphrase", passphrase: "route-pass" }] }]);
  });
});

describe("vault door — status, unlock, bind, unbind", () => {
  it("status prints the custody tree, the rows and the relation class", async () => {
    expect(await run("status")).toBe(0);
    const j = JSON.parse(out.join("").trim().split("\n").pop()!);
    expect(j.data.custody.tree.reading).toBe("readable");
    expect(j.data.custody.tree.slots).toHaveLength(1);
    expect(j.data.custody.rows.some((r: { row: string; reading: string }) => r.row === "custody-root" && r.reading === "sealed")).toBe(true);
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

    // unbind WITHOUT --rotate: the offer rides the result every time; the carriers keep their VK.
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

  it("★ status counts only hot and cold rows as owed, and says the floor rows never count ★", async () => {
    // a bare floor row and a bare hot row stand beside the sealed custody root
    const homes = vesselCustodyHomes();
    writeFileSync(join(homes.identity, ".vessel-key-x.json"), "{}");
    writeFileSync(join(homes.identity, "anchor-roster.json"), "{}");
    const st = await custodyStatus({ io: new FsCustodyIo(homes), homes });
    const bare = st.rows.filter((r) => r.reading === "bare");
    expect(bare.some((r) => r.custody === "floor")).toBe(true);
    const owed = bare.filter((r) => r.custody === "hot" || r.custody === "cold").length;
    expect(owed).toBe(1);
    const plain = cmdVault(parseArgs(["vault", "status", "--no-json"]));
    expect(await plain).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(new RegExp(`\\b${owed} hot/cold carrier\\(s\\) read bare`));
    expect(text).toMatch(/custody-root\s+device-minted\s+sealed/);   // one reading of the file, in both tables
    expect(text).toMatch(/Floor rows \(floor, floor-plain\) never move under it and are not counted/);
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
