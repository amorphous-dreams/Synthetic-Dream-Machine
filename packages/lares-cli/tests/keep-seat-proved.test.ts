/**
 * keep-seat-proved — the keep pair seats only under the route the custody open PROVED, never under what the unlock merely read.
 *
 * A keep seat minted under a typo locks every later restore out, silently: the bundle opens under nothing the steward knows.
 * So the unlock seats from the credentials the custody open names as its opener, never on `already-unlocked` (which tested
 * nothing), checks the seat right after the mint, and at each later proved unlock checks that the resting seat still opens.
 * A custody slot of two pins seats a keep slot of the same two pins: never one pin under the passphrase alone.
 *
 *   KP1  RED: a real `vault unlock` that read a typo and then the right passphrase seats under the right one; the typo opens
 *        nothing. CONTROL: the unlock opened.
 *   KP2  RED: an `already-unlocked` answer seats nothing, whatever the route.
 *   KP3  RED: a 2-of-2 opener (passphrase and paper) seats a 2-of-2 keep slot: the passphrase alone opens nothing.
 *   KP4  RED: a later proved unlock whose route opens no slot of the resting seat warns by name; one that opens says nothing.
 *   KP5  RED: a mint under a weak passphrase seats and WARNS by name (`keep-passphrase-weak`), never refuses.
 *   KP6  RED: `lares vault reseat` mints a fresh pair under the route custody proves; a wrong route refuses and the seat stands.
 *   KP7  RED: `lares vault unbind` (the custody passphrase changing) re-seats the keep under the staying route that proved it.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 120_000 });

const answers: string[] = [];
vi.mock("../src/prompt-secret.js", () => {
  const next = (): Promise<string> => Promise.resolve(answers.shift() ?? "");
  return { canPromptSecret: () => true, promptLine: () => next(), promptSecret: () => next(), promptSecretConfirmed: () => next() };
});

import { FsCustodyIo, foundCustody, vesselCustodyHomes } from "@lararium/node";
import { confirmPaperPin, draftPaperPin, type Credential } from "@lararium/mesh";
import { parseArgs } from "../src/parse-args.js";

let cmdVault: typeof import("../src/commands/vault.js").cmdVault;
let seats: typeof import("../src/keep-seat.js");
beforeAll(async () => {
  vi.resetModules();
  ({ cmdVault } = await import("../src/commands/vault.js"));
  seats = await import("../src/keep-seat.js");
});

const PW = "the steward's proved words";
const TYPO = "the steward's porved words";
const PULAMA_KEYS = ["HOME", "LARES_PULAMA", "LAR_PULAMA_SOCKET"] as const;
let root: string;
let prior: Record<string, string | undefined> = {};
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "keep-seat-proved-"));
  process.env["LAR_ROOT"] = root;
  prior = Object.fromEntries(PULAMA_KEYS.map((k) => [k, process.env[k]]));
  process.env["HOME"] = join(root, "operator");
  delete process.env["LARES_PULAMA"]; delete process.env["LAR_PULAMA_SOCKET"];
  answers.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks(); delete process.env["LAR_ROOT"];
  for (const k of PULAMA_KEYS) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
  rmSync(root, { recursive: true, force: true });
});

const opens = async (creds: readonly Credential[]): Promise<string> => (await seats.openKeepSeat(seats.readKeepSeat()!, creds)).reading;

describe("the keep pair seats under the proved route alone", () => {
  test("KP1 RED: a real unlock that read a typo, then the right passphrase, seats under the right one", async () => {
    const homes = vesselCustodyHomes();
    await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PW }] }] });
    answers.push("p", TYPO, "y", "p", PW, "n");
    expect(await cmdVault(parseArgs(["vault", "unlock", "--json"])), "CONTROL: the unlock opened").toBe(0);
    expect(seats.readKeepSeat(), "the proved unlock seated the keep pair").not.toBeNull();
    expect(await opens([{ kind: "passphrase", passphrase: PW }])).toBe("opens");
    expect(await opens([{ kind: "passphrase", passphrase: TYPO }]), "the typo the unlock read seats nothing").toBe("no-slot-opens");
  });

  test("KP2 RED: an already-unlocked answer seats nothing", async () => {
    const said: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "already-unlocked" }, [{ kind: "passphrase", passphrase: TYPO }], (l) => said.push(l))).toBe("unproved");
    expect(seats.readKeepSeat()).toBeNull();
  });

  test("KP3 RED: a 2-of-2 opener seats a 2-of-2 keep slot, never the passphrase alone", async () => {
    const draft = draftPaperPin();
    confirmPaperPin(draft, draft.sheets);
    const creds: Credential[] = [{ kind: "passphrase", passphrase: PW }, { kind: "paper", sheets: draft.sheets }];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0, 1] }, creds, () => {})).toBe("seated");
    expect(seats.readKeepSeat()!.slots.slots[0]!.t).toBe(2);
    expect(await opens([{ kind: "passphrase", passphrase: PW }]), "the passphrase alone opens nothing").toBe("no-slot-opens");
    expect(await opens(creds)).toBe("opens");
  });

  test("KP4 RED: a later proved unlock whose route opens no slot of the resting seat warns by name", async () => {
    await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: PW }], () => {});
    const quiet: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: PW }], (l) => quiet.push(l))).toBe("resting");
    expect(quiet).toEqual([]);
    const warned: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: "a changed passphrase" }], (l) => warned.push(l))).toBe("resting-unopened");
    expect(warned.join("\n")).toMatch(/keep-seat-unopened/);
  });

  test("KP5 RED: a weak passphrase seats and warns by name", async () => {
    const said: string[] = [];
    expect(await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: "hunter2" }], (l) => said.push(l))).toBe("seated");
    expect(said.join("\n")).toMatch(/keep-passphrase-weak/);
  });

  test("KP6 RED: vault reseat mints a fresh pair under the proved route; a wrong route refuses and the seat stands", async () => {
    const homes = vesselCustodyHomes();
    await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PW }] }] });
    await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: PW }], () => {});
    const before = Buffer.from(seats.readKeepSeat()!.publicKey).toString("hex");
    answers.push("p", TYPO, "n");
    expect(await cmdVault(parseArgs(["vault", "reseat", "--json"])), "a wrong route refuses").toBe(1);
    expect(Buffer.from(seats.readKeepSeat()!.publicKey).toString("hex")).toBe(before);
    answers.push("p", PW, "n");
    expect(await cmdVault(parseArgs(["vault", "reseat", "--json"]))).toBe(0);
    expect(Buffer.from(seats.readKeepSeat()!.publicKey).toString("hex"), "a fresh pair").not.toBe(before);
    expect(await opens([{ kind: "passphrase", passphrase: PW }])).toBe("opens");
  });

  test("KP7 RED: vault unbind re-seats the keep under the staying route", async () => {
    const PW2 = "the steward's new words";
    const homes = vesselCustodyHomes();
    await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PW }] }, { t: 1, pins: [{ kind: "passphrase", passphrase: PW2 }] }] });
    await seats.seatKeepAtUnlock({ reading: "opens", opener: [0] }, [{ kind: "passphrase", passphrase: PW }], () => {});
    const { custodyStatus } = await import("@lararium/node");
    const s = await custodyStatus({ io: new FsCustodyIo(homes), homes });
    const first = s.tree.reading === "readable" ? s.tree.slots[0]!.id : "";
    answers.push("p", PW2, "n");
    expect(await cmdVault(parseArgs(["vault", "unbind", first, "--json"]))).toBe(0);
    expect(await opens([{ kind: "passphrase", passphrase: PW2 }]), "the staying route opens the re-seated keep").toBe("opens");
    expect(await opens([{ kind: "passphrase", passphrase: PW }]), "the removed passphrase opens the new keep no more").toBe("no-slot-opens");
  });
});
