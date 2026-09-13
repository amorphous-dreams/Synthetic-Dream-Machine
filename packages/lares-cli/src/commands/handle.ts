/**
 * `lares handle {publish|rotate|graft|burn|attest|verify-attestation}` — the Handle's verb family.
 *
 * A Handle names a persona's public "here I am" note: a self-certifying card announced onto the Nexus WHO
 * board. Its lifecycle rides the handle-KEL (a sibling grammar to the persona-KEL): publish · rotate · graft ·
 * burn · attest, and the RECOGNISER's half, verify-attestation. `publish` · `rotate` · `burn` · `attest` ·
 * `verify-attestation` stand live; `graft` scaffolds its ahu — its KEL MINT primitive lives in @lararium/mesh
 * (mintHandleGraft) and the stub names the vessel-side orchestration a later pass wires (gather the presenting
 * owner-set's authorization, mint, write back). A Handle anchors to its persona (the persona-KEL prefix owns
 * it), so a lost presentation key recovers through the persona; that owner-binding authorizes rotation and is
 * why these verbs cannot fold into `persona`.
 *
 * ★ THE TWO HALVES OF AN ATTESTATION — the split this door refuses to collapse. ★ `attest` MINTS a signed
 * claim under the head Handle key; `verify-attestation` runs the CHAIN half of checking one, reader-locally:
 * does the chain the statement claims under verify, stand unburned, and seat the very head that signed it? It
 * touches no network and consults no board, and a pass says THE HANDLE SAID IT — never that the claim holds in
 * the world. The SURFACE half (asking DNS whether this Handle really controls example.net) lives nowhere in
 * this door; a recogniser who reads a chain-verdict as a surface-verdict has been told a thing nobody proved.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/handle-card
 */
import { readFileSync } from "node:fs";
import type { ParsedArgs } from "../parse-args.js";
import { runHandlePublish, runHandleBurn, runHandleRotate, runHandleAttest, loadNodeHandleBook } from "@lararium/node";
import {
  verifyAttestation, normalizeHandleClaim, handleClaimFrom, handleClaimSubject, HANDLE_CLAIM_SURFACES,
  type HandleAttestation, type HandleKelEvent,
} from "@lararium/mesh";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";

/** A recognized-but-unwired verb reports its shape and where its ahu waits, then declines to act. */
function declared(verb: string, willDo: string, mint: string): number {
  console.error(`[lares handle ${verb}] declared, not yet wired — ${willDo}`);
  console.error(`  the KEL mint stands (@lararium/mesh ${mint}); the vessel-side orchestration awaits its pass.`);
  console.error(`  canon: lar:///ha.ka.ba/lararium/mesh/handle-card`);
  return 3;
}

/** Refuse through the ONE choke point, so an agent under `--json` reads a verdict and never bare prose. */
function refuse(args: ParsedArgs, detail: string): number {
  return refuseUsage(args, "handle", helpLines("handle"), detail);
}

async function handlePublish(args: ParsedArgs): Promise<number> {
  const glamour = args.positional[1] ?? args.options["glamour"];
  if (!glamour) {
    return refuse(args, 'publish wants a glamour (display name): lares handle publish "Guru-Josh"');
  }
  const opts: Parameters<typeof runHandlePublish>[0] = { glamour };
  if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
  const card = await runHandlePublish(opts);
  console.log(`[lares handle] published "${card.glamour}" — nym ${card.nym.slice(0, 24)}… (v${card.version})`);
  return 0;
}

/** Read a statement argument: bare JSON, `@<path>`, or `-` (stdin) — the carriage grammar `circle card` keeps.
 *  A read fault reads as a refusal, never a crash: WITHHOLD, never forge. */
function readStatementArg(args: ParsedArgs, raw: string): string | number {
  if (raw === "-") {
    try { return readFileSync(0, "utf8"); }
    catch (err) { return refuse(args, `cannot read the statement from stdin: ${err instanceof Error ? err.message : String(err)}`); }
  }
  if (raw.startsWith("@")) {
    const path = raw.slice(1);
    try { return readFileSync(path, "utf8"); }
    catch (err) { return refuse(args, `cannot read the statement file "${path}": ${err instanceof Error ? err.message : String(err)}`); }
  }
  return raw;
}

/**
 * Does this object carry the four fields an attestation is made of, with the claim reading as a STRUCTURED
 * EDGE? A statement missing one verifies nothing, and a PROSE claim verifies nothing either — it names no
 * surface for the other half to reach, so no signature over it could mean anything.
 */
function asAttestation(value: unknown): HandleAttestation | null {
  if (typeof value !== "object" || value === null) return null;
  const o = value as Record<string, unknown>;
  const shaped = ["prefix", "headEventCid", "sig"].every((k) => typeof o[k] === "string" && (o[k] as string).length > 0);
  if (!shaped) return null;
  if (!normalizeHandleClaim(o["claim"])) return null;
  return o as unknown as HandleAttestation;
}

/**
 * `lares handle verify-attestation <statement | @file | -> [--card <file>]` — the RECOGNISER's door.
 *
 * THE CHAIN-VERIFY HALF, AND ONLY THAT HALF. The chain the statement claims under comes from the reader's own
 * side: a carried card (`--card`), else the local handle-book (what this vessel already recognises). Nothing
 * dials out, nothing consults a board. `verifyAttestation` then answers whether the chain verifies, stands
 * unburned, matches the statement's prefix, seats the head the statement bound, and carries that head key's
 * signature over this exact claim.
 *
 * A HOLDING VERDICT PROVES THE HANDLE SAID IT, NEVER THAT THE CLAIM IS TRUE. Asking the world whether the claim
 * holds — DNS for "controls example.net", the named service for a profile — is the SURFACE half, a separate act
 * this door does not perform and does not imply. The rendering says so on both channels, because a recogniser
 * who reads one for the other holds a guarantee nobody made.
 *
 * FAIL-CLOSED: an unmet Handle with no `--card` refuses NOT-FOUND rather than guessing a chain; a malformed
 * statement refuses as usage; a refused verdict exits non-zero so a script branches on it.
 */
async function handleVerifyAttestation(args: ParsedArgs): Promise<number> {
  const rawArg = args.positional[1];
  if (!rawArg) {
    return refuse(args, "verify-attestation wants a statement (the JSON `lares handle attest` printed), `@file`, or `-` for stdin");
  }
  const text = readStatementArg(args, rawArg);
  if (typeof text === "number") return text;

  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return refuse(args, "the statement is not valid JSON — carry the object `lares handle attest` printed"); }
  const statement = asAttestation(parsed);
  if (!statement) {
    return refuse(args, "the statement lacks prefix · headEventCid · sig, or its claim does not read as a structured edge (a known surface + its subject) — such a statement verifies nothing");
  }

  // THE CHAIN COMES FROM THE READER'S OWN SIDE — a carried card, else this vessel's recognition memory.
  let chain: readonly HandleKelEvent[] | null = null;
  let chainSource = "";
  const cardPath = typeof args.options["card"] === "string" ? args.options["card"] : undefined;
  if (cardPath) {
    let card: { nym?: unknown; chain?: unknown };
    try { card = JSON.parse(readFileSync(cardPath, "utf8")) as { nym?: unknown; chain?: unknown }; }
    catch (err) { return refuse(args, `cannot read the --card file "${cardPath}": ${err instanceof Error ? err.message : String(err)}`); }
    if (!Array.isArray(card.chain) || card.chain.length === 0) {
      return refuse(args, `the --card file "${cardPath}" carries no handle-KEL chain — a card without its chain proves nothing`);
    }
    if (typeof card.nym === "string" && card.nym !== statement.prefix) {
      return refuse(args, "the carried card names a DIFFERENT Handle than the statement — carry the card of the Handle that signed it");
    }
    chain = card.chain as HandleKelEvent[];
    chainSource = "card";
  } else {
    const record = loadNodeHandleBook().get(statement.prefix);
    if (!record) {
      emit(args, {
        ok: false,
        error: {
          code: "not-found",
          message: `this vessel has never met ${statement.prefix.slice(0, 24)}… — no chain to verify the statement against`,
          hint: "carry the Handle's card: `lares handle verify-attestation <statement> --card <card.json>`, or admit it first with `lares circle card <carriage>`",
        },
        data: { verdict: "unknown", prefix: statement.prefix, chainSource: "none" },
        human: () => {
          console.error(`lares handle verify-attestation: this vessel has never met ${statement.prefix.slice(0, 24)}….`);
          console.error("  carry its card (--card <card.json>) or admit it first: lares circle card <carriage>");
        },
      });
      return exitFor("not-found");
    }
    chain = record.card.chain;
    chainSource = "handle-book";
  }

  const verdict = await verifyAttestation(chain, statement);
  if (!verdict.ok) {
    const reason = verdict.reason ?? "the attestation does not verify against this chain";
    emit(args, {
      ok: false,
      error: { code: "verb-error", message: reason },
      data: {
        verdict: "refused", reason, prefix: statement.prefix, claim: statement.claim,
        claimSurface: statement.claim.surface, claimSubject: handleClaimSubject(statement.claim),
        headEventCid: statement.headEventCid, chainSource,
        chainVerify: "refused", surfaceVerify: "out-of-scope",
      },
      human: () => {
        console.error(`lares handle verify-attestation: REFUSED — ${reason}`);
        console.error(`  claim: ${statement.claim.surface} → ${handleClaimSubject(statement.claim)}   handle: ${statement.prefix.slice(0, 24)}…`);
      },
    });
    return exitFor("verb-error");
  }

  emit(args, {
    ok: true,
    data: {
      verdict: "holds", prefix: statement.prefix, claim: statement.claim,
      // The STRUCTURED EDGE, flattened for a peer that greps: WHICH adapter answers, and WHICH foreign name.
      claimSurface: statement.claim.surface, claimSubject: handleClaimSubject(statement.claim),
      ...(statement.claim.returnLocator === undefined ? {} : { claimReturnLocator: statement.claim.returnLocator }),
      headEventCid: statement.headEventCid, chainSource,
      // ★ THE SPLIT, ON THE MACHINE CHANNEL — an agent must never read a chain-verify as a surface-verify.
      chainVerify: "verified", surfaceVerify: "out-of-scope",
    },
    human: () => {
      console.log(`the Handle SAID IT: ${statement.prefix.slice(0, 24)}… signed [${statement.claim.surface} → ${handleClaimSubject(statement.claim)}] under its current head.`);
      console.log(`  chain-verify: PASSED reader-locally (chain from the ${chainSource}; no board, no network consulted).`);
      console.log(`  surface-verify: NOT RUN — this says nothing about whether the claim holds in the world.`);
      console.log(`  a face may honestly sign a dns-control edge and hold no such zone; reaching the ${statement.claim.surface} surface is a separate act.`);
    },
  });
  return 0;
}

/**
 * `lares handle attest --surface <kind> --subject <name> [--return-locator <where>]` — mint a STRUCTURED edge.
 *
 * ★ TWO FLAGS, NOT A SENTENCE AND NOT A JSON BLOB. ★ A claim asserts that this Handle stands in a NAMED
 * relation to a NAMED foreign subject, readable by a peer sharing none of our context (the operator's ruling,
 * 2026-09-13). `--surface` names the adapter family's row and therefore WHOSE authority answers the check;
 * `--subject` names the foreign name in that surface's own grammar. The subject rides ONE flag across every
 * surface, so a NEW adapter opens this door by naming a new `--surface` value and adds no flag — the union's
 * "a new adapter is a new MEMBER" law, spoken at the door. `--return-locator` carries where the surface half
 * looks for the leg coming back; absent, the adapter reads its own conventional location.
 *
 * A CLOSED VOCABULARY REFUSES A TYPO LOUDLY. A free-text claim minted an edge no adapter answers and nothing
 * surfaced until a reader tried to check it; here an unknown surface refuses at the door and names the rows.
 */
async function handleAttest(args: ParsedArgs): Promise<number> {
  const surface = args.options["surface"];
  const subject = args.options["subject"];
  const spelling = `lares handle attest --surface <${HANDLE_CLAIM_SURFACES.join("|")}> --subject <name> [--return-locator <where>] [--persona <index>]`;
  if (!surface || !subject) {
    return refuse(args, `attest wants a STRUCTURED claim, never prose: ${spelling}`);
  }
  const claim = handleClaimFrom(surface, subject, typeof args.options["return-locator"] === "string" ? args.options["return-locator"] : undefined);
  if (!claim) {
    return refuse(args, `no adapter answers surface "${surface}" with subject "${subject}" — the surfaces are ${HANDLE_CLAIM_SURFACES.join(" · ")}`);
  }
  const opts: Parameters<typeof runHandleAttest>[0] = { claim };
  if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
  const statement = await runHandleAttest(opts);
  // A standalone signed statement the operator carries out-of-band; a reader verifies it against the surface.
  console.log(JSON.stringify(statement));
  return 0;
}

export async function cmdHandle(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  switch (sub) {
    case "publish": return await handlePublish(args);
    case "rotate": {
      const opts: Parameters<typeof runHandleRotate>[0] = {};
      if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
      const card = await runHandleRotate(opts);
      console.log(`[lares handle] rotated "${card.glamour}" — nym ${card.nym.slice(0, 24)}… seats a fresh key (v${card.version})`);
      return 0;
    }
    case "graft":
      return declared("graft", "turn the presenting owner-set over (succession); TRUE k-of-n graft governance rides declared", "mintHandleGraft");
    case "burn": {
      const opts: Parameters<typeof runHandleBurn>[0] = {};
      if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
      if (args.flags["from-persona"] === true) Object.assign(opts, { fromPersona: true });   // owner-burn (from above)
      const card = await runHandleBurn(opts);
      const hand = args.flags["from-persona"] === true ? "the persona buried it from above" : "the seated key buried it";
      console.log(`[lares handle] burned "${card.glamour}" — nym ${card.nym.slice(0, 24)}… is terminal, readers refuse it (${hand})`);
      return 0;
    }
    case "verify-attestation": return await handleVerifyAttestation(args);
    case "attest": return await handleAttest(args);
    default:
      return refuse(args, sub ? `unknown sub-verb "${sub}"` : "name a sub-verb");
  }
}
