/**
 * nexus-verb-reach — every door `lares nexus` opens still opens, and the two rites still reach.
 *
 * ── WHY A REACH TEST AND NOT A BEHAVIOUR TEST ───────────────────────────────────────────────────
 * `nexus.ts` is five doors in one file — roster/contract, kāhuli, the charter seal and its epoch
 * chain, the kāpae antigen, and the realm/bag pair. Splitting it moves code without changing what any
 * of it does, so there is no OUTCOME to assert that would have read differently before the move. What
 * a split CAN silently break is REACH: a verb that stops being routed, a rite whose handler no longer
 * resolves across a module boundary, a usage array that moves away from the `default:` naming it.
 *
 * So this asks the only question the move can answer wrongly — does every verb still get somewhere —
 * and asks it of the DISPATCHER, `cmdNexus`, the single symbol every importer takes and the one the
 * split leaves in place. A verb that dispatches and then fails on its own domain grounds (no charter
 * on a bare tree, no vessel key) has REACHED; that is a pass. Only "I do not know this word" fails.
 *
 * ── BOTH SURFACES, BECAUSE THE DOOR SPEAKS TWICE ────────────────────────────────────────────────
 * `emit` picks its channel by `wantsJson`, which falls back to `!stdout.isTTY` — so under a test
 * runner the JSON path is the DEFAULT and the prose never runs. A capture that watched only
 * `console.error` would read empty and call it a pass. Both channels are captured here, and the usage
 * prose is pinned under an explicit `json:false`, which is the only way those arrays are reached.
 *
 * Nothing here pins behaviour. `nexus-kahuli`, `nexus-seal-lineage`, `nexus-seal-grow` and
 * `seal-reserve` own that, and they keep importing `cmdNexus` from this same door.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (positional: string[], flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options: {}, flags } as unknown as ParsedArgs);

/** Every verb `cmdNexus` routes. A door dropped from the switch but left in the usage text reads as a
 *  door to a human and refuses to a machine, so the list is the switch's own. */
const VERBS = [
  "seal", "kapae", "un_kapae", "contract", "revoke", "members",
  "accept-carriage", "posture", "rite", "kahuli", "refresh",
  "realm-bag", "realm-bags",
] as const;

describe("lares nexus — every verb reaches its door", () => {
  let root: string;
  let said: string[];
  const saved: Record<string, string | undefined> = {};
  const ENV = ["LAR_ROOT", "LAR_SEAL_HOME", "LAR_DATA_DIR"];

  /** Both channels. The door speaks JSON to a pipe and prose to a person; a reach test must hear both. */
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-verb-reach-"));
    for (const k of ENV) { saved[k] = process.env[k]; process.env[k] = root; }
    said = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { said.push(String(c)); return true; });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; }
    rmSync(root, { recursive: true, force: true });
  });

  /** Run a door and return everything it said. A THROW is still a reach — the verb found its handler
   *  and the handler objected, which is a domain refusal wearing an exception. */
  const run = async (positional: string[], flags: Record<string, boolean> = {}): Promise<string> => {
    said = [];
    try { await cmdNexus(args(positional, flags)); } catch (e) { said.push(String(e)); }
    return said.join("\n");
  };

  test.each(VERBS)("`nexus %s` reaches a door — it is never an unknown verb", async (verb) => {
    const out = await run([verb]);
    expect(out, `\`${verb}\` said nothing at all — no channel carried a verdict`).not.toBe("");
    expect(out, `\`${verb}\` fell through to the unknown-verb refusal`).not.toMatch(/unknown verb/i);
  });

  /**
   * CONTROL — the refusal still fires for a word that IS unknown. Without it the sweep above passes
   * for a `cmdNexus` that lost its `default:` entirely: the same failure wearing a green.
   */
  test("a bogus verb still refuses, and says so", async () => {
    // The MACHINE channel carries the reason: `refuseUsage` puts it in the error payload.
    expect(await run(["definitely-not-a-verb"])).toMatch(/unknown verb/i);
    // The HUMAN channel carries the usage block. It does NOT repeat the reason — `refuseUsage`'s
    // `human()` prints the lines alone, so the prose reader sees WHAT IS VALID, not what they typed.
    // Recorded as the surface that stands, not endorsed; the split must not change it either way.
    expect(await run(["definitely-not-a-verb"], { json: false })).toMatch(/usage: lares nexus/);
    expect(await cmdNexus(args(["definitely-not-a-verb"]))).toBe(2);
  });

  /** CONTROL — a bare `nexus` refuses with the usage and claims no word was unknown. */
  test("no verb at all refuses with the usage, naming no unknown word", async () => {
    const prose = await run([], { json: false });
    expect(prose).not.toMatch(/unknown verb/i);
    expect(prose).toMatch(/usage: lares nexus/);
    expect(await cmdNexus(args([]))).toBe(2);
  });

  /**
   * CONTROL — the rites resolve. `NEXUS_RITES` holds its two handlers by REFERENCE, and the split puts
   * both behind a module boundary (`runCabalRite` into the seal door, `runKahuliRite` into kāhuli). An
   * import that failed to resolve, or a rite dropped from the table while usage still advertised it,
   * reads exactly like an unknown petname — so both are named here, never counted.
   */
  test.each(["cabal", "kahuli"])("the rite `%s` is registered and reaches its handler", async (rite) => {
    const out = await run(["rite", rite]);
    expect(out, `the rite \`${rite}\` was not registered`).not.toMatch(/unknown rite/i);
    expect(out).not.toMatch(/unknown verb/i);
    expect(out).not.toBe("");
  });

  /** CONTROL — an unknown petname still refuses, or the assertion above proves nothing. */
  test("an unknown rite petname refuses and names the rites that exist", async () => {
    const out = await run(["rite", "not-a-rite"], { json: false });
    expect(out).toMatch(/cabal/);
    expect(out).toMatch(/kahuli/);
  });

  /**
   * THE USAGE PROSE IS PART OF THE SURFACE, and it just moved: three hand-rolled `usage()` bodies
   * became const arrays behind `refuseUsage`. The split carries two of those arrays into child modules,
   * away from the `default:` branch that names them. Pinning the bytes means a move that drops a line,
   * or lands the wrong array on the wrong door, reads as a diff rather than as nothing at all.
   *
   * `json:false` is required: these arrays are reached ONLY on the human path.
   */
  test("the three usage surfaces read byte-for-byte as they stand", async () => {
    expect(await run(["definitely-not-a-verb"], { json: false })).toMatchSnapshot("nexus usage");
    expect(await run(["seal", "not-a-subverb"], { json: false })).toMatchSnapshot("seal usage");
    expect(await run(["kahuli", "not-a-tier"], { json: false })).toMatchSnapshot("kahuli usage");
  });
});
