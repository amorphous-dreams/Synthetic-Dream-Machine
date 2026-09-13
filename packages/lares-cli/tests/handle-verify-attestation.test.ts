/**
 * ★ A MINTED ATTESTATION MUST HAVE A DOOR THAT CHECKS IT ★
 *
 * `lares handle attest "<claim>"` mints a signed statement under the head Handle key on two platforms, and
 * before this door stood, `verifyAttestation` (@lararium/mesh handle-kel) reached NO production caller — the
 * whole tree held one occurrence of the name, its own declaration. A recogniser who received such a statement
 * held a guarantee nothing could run.
 *
 * THE SPLIT THIS FILE FENCES. `verify-attestation` runs the CHAIN-VERIFY half alone: does the chain the
 * statement claims under verify structurally, stand unburned, match the statement's prefix, seat the very head
 * the statement bound, and sign it with that head's Handle key? It consults NO board and NO network. A pass
 * proves THE HANDLE SAID IT — never that the claim holds in the world. The SURFACE-VERIFY half (does DNS agree
 * that this Handle controls example.net?) is a separate act this door refuses to imply.
 *
 * The sharp vectors, each with its CONTROL:
 *   · a well-formed CURRENT attestation passes,
 *   · one bound to a head the chain has since ROTATED PAST refuses as STALE,
 *   · one whose chain is BURNED refuses — a buried name claims nothing,
 *   · a Handle the reader never met refuses NOT-FOUND rather than guessing a chain,
 *   · every refusal rides `emit`, so an agent under `--json` reads a verdict and never bare prose.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mintHandleInception, mintHandleRotation, mintHandleBurn, attestUnderHead,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, sealKeySetHash,
  type HandleKelEvent, type HandleAttestation,
} from "@lararium/mesh";
import { dispatch } from "../src/bin/lares.js";

afterEach(() => vi.restoreAllMocks());

/** Capture what an AGENT reads: stdout alone. Prose on stderr is the human's channel and never parsed. */
function captureJson(): { lines: string[] } {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  return { lines };
}

const parse = (lines: readonly string[]) =>
  JSON.parse(lines.join("")) as { ok: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } };

const HANDLE_SEED_A = new Uint8Array(32).fill(51);   // the inception Handle key
const HANDLE_SEED_B = new Uint8Array(32).fill(52);   // the key a rotation seats
const OWNER_SEED    = new Uint8Array(32).fill(61);   // the owning persona's head op-key
const RECOVERY_SEED = new Uint8Array(32).fill(81);
const OWNER_PREFIX  = "persona-owner-of-the-face";

/** A founded 1-of-1 Handle — the degenerate personal face, its chain and its two signers. */
async function foundFace() {
  const handleKeyDid    = `0x${await ed25519VerifyingKeyFromSeed(HANDLE_SEED_A)}`;
  const recoverySetHash = sealKeySetHash([await ed25519VerifyingKeyFromSeed(RECOVERY_SEED)], 1);
  const inception       = mintHandleInception(handleKeyDid, OWNER_PREFIX, recoverySetHash);
  return { inception, signA: ed25519SignerFromSeed(HANDLE_SEED_A) };
}

/** Write a carried card (the recogniser's chain source) and the statement to a scratch dir. */
function scratch(nym: string, chain: readonly HandleKelEvent[], statement: HandleAttestation) {
  const dir = mkdtempSync(join(tmpdir(), "lares-attest-"));
  const cardPath = join(dir, "card.json");
  writeFileSync(cardPath, JSON.stringify({ nym, chain }), "utf8");
  return { cardPath, statementArg: JSON.stringify(statement) };
}

describe("★ lares handle verify-attestation — the READER-LOCAL chain-verify door ★", () => {
  test("a well-formed CURRENT attestation HOLDS against the carried chain", async () => {
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);
    const { cardPath, statementArg } = scratch(inception.prefix, [inception], stmt);

    const cap = captureJson();
    const code = await dispatch(["handle", "verify-attestation", statementArg, "--card", cardPath, "--json"]);
    expect(code, "a holding attestation exits clean").toBe(0);
    const out = parse(cap.lines);
    expect(out.ok).toBe(true);
    expect(out.data?.["verdict"]).toBe("holds");
    expect(out.data?.["claim"]).toBe("controls example.net");
    // THE SPLIT, ON THE MACHINE CHANNEL: an agent must not read a chain-verify as a surface-verify.
    expect(out.data?.["chainVerify"]).toBe("verified");
    expect(out.data?.["surfaceVerify"]).toBe("out-of-scope");
  });

  test("★ STALE — an attestation bound to a head the chain ROTATED PAST refuses ★", async () => {
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: `0x${await ed25519VerifyingKeyFromSeed(HANDLE_SEED_B)}`,
      ownerAuthMemberPrefix: OWNER_PREFIX, ownerHeadOpKeyDid: `0x${await ed25519VerifyingKeyFromSeed(OWNER_SEED)}`,
      sign: ed25519SignerFromSeed(OWNER_SEED),
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    const { cardPath, statementArg } = scratch(inception.prefix, [inception, rot.event], stmt);

    const cap = captureJson();
    const code = await dispatch(["handle", "verify-attestation", statementArg, "--card", cardPath, "--json"]);
    expect(code, "a refused verdict exits non-zero so a script branches").toBe(4);
    const out = parse(cap.lines);
    expect(out.ok).toBe(false);
    expect(out.data?.["verdict"]).toBe("refused");
    expect(String(out.error?.message), "the reason names the staleness").toMatch(/stale/i);
  });

  test("★ BURNED — an attestation under a buried name refuses ★", async () => {
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);
    const burn = await mintHandleBurn({ head: inception, sign: signA });
    expect(burn.ok, burn.ok ? "" : burn.reason).toBe(true);
    if (!burn.ok) return;
    const { cardPath, statementArg } = scratch(inception.prefix, [inception, burn.event], stmt);

    const cap = captureJson();
    const code = await dispatch(["handle", "verify-attestation", statementArg, "--card", cardPath, "--json"]);
    expect(code).toBe(4);
    const out = parse(cap.lines);
    expect(out.ok).toBe(false);
    expect(String(out.error?.message)).toMatch(/burn/i);
  });

  test("CONTROL — a TAMPERED claim refuses, so the pass above rests on the signature and not on the shape", async () => {
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);
    const bent = { ...stmt, claim: "controls example.org" };
    const { cardPath, statementArg } = scratch(inception.prefix, [inception], bent);

    const cap = captureJson();
    expect(await dispatch(["handle", "verify-attestation", statementArg, "--card", cardPath, "--json"])).toBe(4);
    expect(parse(cap.lines).ok).toBe(false);
  });

  test("an UNMET Handle refuses NOT-FOUND — the reader never guesses a chain it does not hold", async () => {
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);

    const cap = captureJson();
    const code = await dispatch(["handle", "verify-attestation", JSON.stringify(stmt), "--json"]);
    expect(code, "an unmet Handle is not-found, never a false verdict").toBe(3);
    const out = parse(cap.lines);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("not-found");
  });

  test("a MALFORMED statement refuses as usage, through the emit choke point", async () => {
    const cap = captureJson();
    const code = await dispatch(["handle", "verify-attestation", "{not json", "--json"]);
    expect(code).toBe(2);
    const out = parse(cap.lines);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("usage");
  });

  test("CONTROL — at a TTY the door prints prose and emits NO machine payload", async () => {
    // `emit` renders JSON under `--json` OR off-TTY, and vitest is NEVER a TTY: without this the control
    // would pass for the wrong reason.
    const { inception, signA } = await foundFace();
    const stmt = await attestUnderHead([inception], "controls example.net", signA);
    const { cardPath, statementArg } = scratch(inception.prefix, [inception], stmt);
    const wasTty = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    try {
      const cap = captureJson();
      const code = await dispatch(["handle", "verify-attestation", statementArg, "--card", cardPath]);
      expect(code).toBe(0);
      expect(cap.lines.join(""), "a human's channel carries no machine payload").toBe("");
    } finally {
      Object.defineProperty(process.stdout, "isTTY", { value: wasTty, configurable: true });
    }
  });
});

describe("★ the door's words name the chain-verify ⊥ surface-verify split ★", () => {
  test("the help registry holds the handle door, and it names BOTH halves", async () => {
    const { helpLines } = await import("../src/command-help.js");
    const text = helpLines("handle").join("\n");
    expect(text, "the spine an operator greps for").toMatch(/usage: lares handle/);
    expect(text).toMatch(/verify-attestation/);
    expect(text, "a chain-verify must never read as a surface-verify").toMatch(/surface/i);
  });
});
