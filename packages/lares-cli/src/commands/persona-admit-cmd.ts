/**
 * `lares persona admit …` — the operator's door to the airgapped PERSONA-ADMISSION 3-hop (a persona moves onto
 * another vessel, isomorphic to a hardware wallet's device-to-device key hand-off). Each hop is a SEPARATE,
 * offline invocation; a QR (or a pasted `#enroll=`/`#grant=`/`#ack=` carriage) crosses the airgap between them.
 *
 *   offer                         (B, target)  mint an enrollment offer for THIS vessel's device key; show QR#1.
 *   grant --offer <c> --index <N> --prefix <aid>
 *                                 (A, granter) seal persona h<N> onto B's offer, signed by the persona's op-key,
 *                                              verified at open against the persona PREFIX head; show QR#2.
 *   open  --grant <c>             (B, target)  open + verify + RECORD into this vessel's local view; show QR#3.
 *   accept --ack <c>              (A, granter) verify B's ACK + RECORD into this vessel's local view.
 *   list                          the PER-VESSEL multitude-view (personas admitted to THIS vessel; never syncs).
 *   reset                         drop any in-flight pending enrollment / grant secrets.
 *   withdraw-offer [--ephemeral <k>|--all]
 *                                 (B, target)  CAUSAL withdrawal (§2a): the offerer's OWN patience ends, so it
 *                                              consumes its own pending offer before any grant can open it —
 *                                              never a clock comparison.
 *   withdraw-grant --nonce <nonceA>
 *                                 (A, granter) the same causal withdrawal on A's side: a sent grant's memo is
 *                                              dropped, so a late ACK answering it refuses by name.
 *
 * This command THIN-WRAPS the proven node flow (`offerAdmitFlow` / `grantAdmitFlow` / `openAdmitFlow` /
 * `acceptAdmitFlow`) — it only builds the signers + the KEL head-resolver from the local vault + board, renders,
 * and prints. The load-bearing invariants (per-vessel-never-syncs, type-blind, wax-seals-only, rotate-not-
 * resurrect, photograph-inert) live in the flow + the ceremony beneath it.
 *
 * ── HONEST BOUNDS (surfaced, not silently relaxed) ──────────────────────────────────────────────────────────
 *  · `--prefix` is the persona's KEL AID: `open` verifies the grant's op-key IS that prefix's CURRENT head
 *    (rotate-not-resurrect), read off THIS vessel's LOCAL persona-KEL board replica. A SAME-Nexus target already
 *    carries the granter's persona-KEL (it federates once); a CROSS-Nexus airgapped target that lacks it gets a
 *    fail-closed refusal until it syncs — the carried-chain-in-grant leg (which may push QR#2 past a static QR to
 *    the reserved bc-ur multi-part path) is the follow-on for the fully-offline cross-Nexus case.
 *  · `grant` signs with the persona-root seed at h<N>. Where a persona has ROTATED its op-key beneath the root,
 *    the operator supplies the head via `--prefix` (the board resolves it); the ceremony never trusts a frozen key.
 */

import { createInterface } from "node:readline";
import { ed25519SignerFromSeed, type PersonaRef } from "@lararium/mesh";
import {
  offerAdmitFlow, grantAdmitFlow, openAdmitFlow, acceptAdmitFlow,
  listAdmittedPersonas, clearPersonaAdmitPending,
  loadVesselSigningSeed, loadVesselVerifyingKey,
  loadPersonaGroupRootVerifyingKey, loadPersonaGroupRootSeed,
  withdrawOfferFlow, withdrawGrantFlow,
} from "@lararium/node";
import { emit, exitFor, wantsJson } from "../render.js";
import { storeVerb } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";

class UsageError extends Error {}

/** The default hold — a tabletop hand-off window, Gaia walking across the room and back. */
const DEFAULT_PATIENCE_MS = 10 * 60_000;

/**
 * Parse an operator-facing duration (`"90s"`, `"10m"`, `"2h"`, a bare integer = ms). Malformed or absent
 * input keeps `fallbackMs` rather than throwing — a patience window is a convenience knob, never a gate.
 */
function parsePatienceMs(raw: unknown, fallbackMs: number): number {
  if (raw === undefined || raw === null || raw === "") return fallbackMs;
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(String(raw).trim());
  if (!m) return fallbackMs;
  const n = Number.parseFloat(m[1]!);
  const unit = m[2] ?? "ms";
  const mult = unit === "ms" ? 1 : unit === "s" ? 1_000 : unit === "m" ? 60_000 : 3_600_000;
  const ms = Math.round(n * mult);
  return Number.isFinite(ms) && ms > 0 ? ms : fallbackMs;
}

/**
 * M8 — arm SIGINT/SIGTERM for a WHOLE held session, not just its wait phase: the returned `aborted` promise
 * settles the first time either fires, and stays usable (the handlers stay REGISTERED) through the
 * post-paste open/accept call that follows a successful paste. Node's default SIGINT/SIGTERM behavior is an
 * immediate process kill; a bare signal arriving mid-open (after `awaitNextHopOrPatience` already resolved,
 * before this session's own finally-based withdraw decision has run) under the OLD code — which tore its
 * handlers down the instant a line was read — would kill the process with NEITHER a withdrawal NOR a clean
 * completion. Keeping a handler registered (even a now-mostly-inert one, since the wait it originally guarded
 * has already settled) prevents that silent kill; `disarm()` tears it down only once this session's own
 * try/finally has decided whether to withdraw.
 */
function armHeldSignals(): { aborted: Promise<void>; disarm: () => void } {
  let resolveAborted: () => void = () => {};
  const aborted = new Promise<void>((res) => { resolveAborted = res; });
  const onSignal = () => resolveAborted();
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  return { aborted, disarm: () => { process.off("SIGINT", onSignal); process.off("SIGTERM", onSignal); } };
}

/**
 * §2a — HOLD the process open awaiting one pasted line on stdin (the next hop's carriage), racing it against
 * THIS holder's own patience (a `setTimeout` DURATION — never a `Date.now()` comparison; the delay itself is
 * the only clock-shaped thing here, and it is this process's own waiting budget, not a safety or admission
 * verdict) and `aborted` (the caller's `armHeldSignals()`, firing on the operator's own SIGINT/SIGTERM).
 * Resolves to the pasted line, or `null` when patience or a signal fired first — the caller then withdraws
 * its OWN pending state before exiting, exactly as Gaia's offer must die without her and a clinic steward's
 * forgotten stack must never outlive the enrolling session.
 *
 * M8 — `finish` now DESTROYS stdin rather than merely closing the `readline` interface: a `readline.Interface`
 * closed over a still-open stdin stream leaves the stream itself ref'd, and the process measurably hung on a
 * held-open pipe (32s observed, versus ~2s once stdin actually closed) rather than exiting once this
 * function's caller finishes its own work. On a real terminal this read as "hangs until Ctrl-C" even though
 * the intended wait had already ended.
 */
function awaitNextHopOrPatience(patienceMs: number, aborted: Promise<void>): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const rl = createInterface({ input: process.stdin });
    let timer: ReturnType<typeof setTimeout>;
    const finish = (line: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rl.close();
      process.stdin.destroy();
      resolve(line);
    };
    timer = setTimeout(() => finish(null), patienceMs);
    aborted.then(() => finish(null));
    rl.once("line", (line) => finish(line));
    rl.once("close", () => finish(null));   // stdin closed with nothing pasted — patience/signal already covers the rest
  });
}

function admitUsage(): void {
  console.error("usage: lares persona admit <offer | grant | open | accept | list | reset | withdraw-offer | withdraw-grant>");
  console.error("");
  console.error("  offer [--patience <dur>] [--detach]      (target) mint an enrollment offer + QR#1, then HOLD");
  console.error("                                            awaiting QR#2 under your own patience (default 10m);");
  console.error("                                            --detach prints QR#1 and exits (the one-shot shape;");
  console.error("                                            withdraw later with `withdraw-offer`).");
  console.error("  grant --offer <carriage> --index <N> --prefix <aid> [--patience <dur>] [--detach]");
  console.error("                                            (granter) seal persona h<N> onto the offer + QR#2, then");
  console.error("                                            HOLD awaiting QR#3 (the ACK) under your own patience.");
  console.error("  open  --grant <carriage>                 (target) open + verify + record + QR#3 (the ACK)");
  console.error("  accept --ack <carriage>                  (granter) verify the ACK + record the join");
  console.error("  list                                     the per-vessel multitude-view (never syncs)");
  console.error("  reset                                    drop any in-flight pending secrets");
  console.error("  withdraw-offer [--ephemeral <pubkey> | --all]   (target) withdraw a pending offer by your own patience");
  console.error("  withdraw-grant --nonce <nonceA>           (granter) withdraw a sent grant by your own patience");
}

/**
 * Print a hop's scannable QR + its carriage (the carriage always travels; the QR is the tabletop
 * convenience). L12 — under `--json` (or any off-TTY machine read) this block is NOISE ahead of the JSON
 * payload line `emit` writes to stdout: a `--json` reader that does `JSON.parse(stdout)` on the whole
 * stream, or reads the first line expecting the payload, meets the QR block instead. Routed to STDERR under
 * JSON mode — the human tabletop view stays on stdout exactly as before when no `--json` is in play.
 */
function printHop(args: ParsedArgs, label: string, hop: { carriage: string; terminalQr: string; qrEcc: string | null; qrOversized: boolean }): void {
  const out = wantsJson(args) ? console.error : console.log;
  out(`${label}:`);
  if (hop.qrOversized) {
    out(`  (payload exceeds a single static QR even at ECC-L — paste the carriage, or use the bc-ur multi-part leg)`);
  } else {
    out(hop.terminalQr);
    out(`  (QR at ECC ${hop.qrEcc})`);
  }
  out(`  carriage: ${hop.carriage}`);
}

export async function cmdPersonaAdmit(args: ParsedArgs): Promise<number> {
  const op = args.positional[1];
  try {
    switch (op) {
      case "offer": {
        const deviceVerifyingKey = await loadVesselVerifyingKey();
        const detach = args.flags["detach"] === true;
        const patienceMs = parsePatienceMs(args.options["patience"], DEFAULT_PATIENCE_MS);
        const hop = await offerAdmitFlow({ deviceVerifyingKey, ...(detach ? {} : { expiryMs: patienceMs }) });
        printHop(args, "enrollment offer (hand QR#1 to the granting vessel)", hop);
        if (detach) {
          emit(args, {
            ok: true,
            data: { carriage: hop.carriage, ephemeralPubkey: hop.offer.ephemeralPubkey, expiry: hop.offer.expiry, detached: true },
            human: () => console.log(`detached — this offer stands pending until opened, withdrawn (\`withdraw-offer --ephemeral ${hop.offer.ephemeralPubkey}\`), evicted by count, or \`reset\`.`),
          });
          return 0;
        }
        // §2a — HELD SESSION: the offer is a live act, not a fire-and-forget. This process holds open awaiting
        // QR#2 (pasted, same as `open --grant` would take it) under its OWN monotonic patience; on patience
        // end, an operator SIGINT/SIGTERM, OR a paste that fails to open (M8) it withdraws its own offer
        // before exiting — no un-withdrawn stale offer survives this process on ANY exit path.
        const { aborted, disarm } = armHeldSignals();
        try {
          console.error(`awaiting the granter's QR#2 — paste the grant carriage and press enter (holds ${patienceMs}ms; Ctrl-C withdraws now).`);
          const pasted = await awaitNextHopOrPatience(patienceMs, aborted);
          if (!pasted) {
            const withdrawn = withdrawOfferFlow(hop.offer.ephemeralPubkey);
            emit(args, {
              ok: true,
              data: { withdrawn: withdrawn > 0, ephemeralPubkey: hop.offer.ephemeralPubkey },
              human: () => console.log("patience ended (or interrupted) with no grant arriving — withdrew this offer."),
            });
            return 0;
          }
          // M8 — this session's own offer is consumed ONLY on a successful open; any other outcome (a
          // garbled paste, a grant answering a different offer, an unresolvable KEL head, a thrown error)
          // leaves the offer un-consumed, and the `finally` below withdraws it — a failed paste used to
          // leave the offer pending indefinitely (bounded only by the pending-set's own count eviction).
          let consumed = false;
          try {
            const deviceSigner = ed25519SignerFromSeed(await loadVesselSigningSeed());
            const resolveHeadOpKey = async (p: string): Promise<string | null> => {
              const head = (await storeVerb("persona-kel-head", { prefix: p })).output["head"];
              return typeof head === "string" ? head : null;
            };
            const resolveHeadSeq = async (p: string): Promise<number | null> => {
              const seq = (await storeVerb("persona-kel-head", { prefix: p })).output["seq"];
              return typeof seq === "number" ? seq : null;
            };
            // M8 — scope the match search to THIS session's own offer: without `onlyEphemeral`, a paste
            // could match (and consume) a DIFFERENT pending offer entirely (a detached sibling, say),
            // leaving THIS session believing it failed while quietly having spent someone else's secret.
            const r = await openAdmitFlow({
              grantCarriage: pasted.trim(), resolveHeadOpKey, deviceSigner, resolveHeadSeq,
              onlyEphemeral: hop.offer.ephemeralPubkey,
            });
            if ("error" in r) throw new UsageError(r.error);
            consumed = true;
            emit(args, {
              ok: true,
              data: { carriage: r.carriage, personaPrefix: r.joinRecord.personaRef.prefix },
              human: () => {
                console.log(`admitted persona ${r.joinRecord.personaRef.prefix} onto this vessel (recorded locally, never synced).`);
                printHop(args, "acknowledgement (hand QR#3 back to the granting vessel to close the join)", r);
              },
            });
            return 0;
          } finally {
            if (!consumed) withdrawOfferFlow(hop.offer.ephemeralPubkey);
          }
        } finally {
          disarm();
        }
      }
      case "grant": {
        const offerCarriage = String(args.options["offer"] ?? "");
        const prefix = String(args.options["prefix"] ?? "");
        const idxRaw = args.options["index"];
        const index = idxRaw !== undefined ? Number.parseInt(String(idxRaw), 10) : 0;
        if (!offerCarriage) throw new UsageError("grant needs --offer <carriage> (the target's QR#1)");
        if (!prefix) throw new UsageError("grant needs --prefix <persona-kel-aid> (the persona's stable identifier)");
        if (!Number.isInteger(index) || index < 0) throw new UsageError(`--index must be a non-negative integer (got "${idxRaw}")`);
        // A grant SIGNS with a held root; it never stands one up. An index this vessel holds no root for refuses.
        const verifyingKey = await loadPersonaGroupRootVerifyingKey(index);
        if (!verifyingKey) throw new UsageError(`this vessel holds no persona root at h${index} — a grant signs only as a persona it carries`);
        const personaRef: PersonaRef = { prefix, verifyingKey };
        const personaSigner = ed25519SignerFromSeed(await loadPersonaGroupRootSeed(index));
        const detach = args.flags["detach"] === true;
        const patienceMs = parsePatienceMs(args.options["patience"], DEFAULT_PATIENCE_MS);
        const r = await grantAdmitFlow({ offerCarriage, personaRef, personaSigner, ...(detach ? {} : { expiryMs: patienceMs }) });
        if ("error" in r) throw new UsageError(r.error);
        printHop(args, "sealed grant (hand QR#2 back to the target vessel)", r);
        if (detach) {
          emit(args, {
            ok: true,
            data: { carriage: r.carriage, oversized: r.qrOversized, detached: true },
            human: () => console.log("detached — this sent grant stands pending until an ACK arrives, is withdrawn, or `reset`."),
          });
          return 0;
        }
        // §2a — HELD SESSION, A's mirror of the offer side: hold open awaiting QR#3 (the ACK) under A's own
        // patience; on patience end, SIGINT/SIGTERM, OR a paste that fails to accept (M8), withdraw the
        // sent-grant memo so a late ACK answering it refuses by name rather than this grant remaining
        // operable past the window A actually stood for it, on ANY exit path.
        const { aborted, disarm } = armHeldSignals();
        try {
          console.error(`awaiting the target's QR#3 (the ACK) — paste it and press enter (holds ${patienceMs}ms; Ctrl-C withdraws now).`);
          const pasted = await awaitNextHopOrPatience(patienceMs, aborted);
          if (!pasted) {
            const withdrawn = withdrawGrantFlow(r.sealed.nonceA);
            emit(args, {
              ok: true,
              data: { withdrawn, nonceA: r.sealed.nonceA },
              human: () => console.log("patience ended (or interrupted) with no ACK arriving — withdrew this sent grant."),
            });
            return 0;
          }
          // M8 — mirrors the offer side: this sent grant is consumed ONLY on a successful accept.
          // `acceptAdmitFlow` itself RE-STASHES its memo on a failed verify (so a transient bad ACK does
          // not silently discard a legitimately-pending grant at the FLOW layer) — this session's own
          // `finally` is what then decides the memo should not outlive THIS held session, and withdraws it.
          let consumed = false;
          try {
            const closeR = await acceptAdmitFlow({ ackCarriage: pasted.trim() });
            if ("error" in closeR) throw new UsageError(closeR.error);
            consumed = true;
            emit(args, {
              ok: true,
              data: { personaPrefix: closeR.joinRecord.personaRef.prefix, targetVesselId: closeR.joinRecord.targetVesselId },
              human: () => {
                console.log(`join CLOSED — persona ${closeR.joinRecord.personaRef.prefix} now stands admitted on vessel ${closeR.joinRecord.targetVesselId.slice(0, 16)}….`);
                console.log(`  both vessels hold the matching mutually-signed record (recorded locally on each, never synced).`);
              },
            });
            return 0;
          } finally {
            if (!consumed) withdrawGrantFlow(r.sealed.nonceA);
          }
        } finally {
          disarm();
        }
      }
      case "open": {
        const grantCarriage = String(args.options["grant"] ?? "");
        if (!grantCarriage) throw new UsageError("open needs --grant <carriage> (the granter's QR#2)");
        const deviceSigner = ed25519SignerFromSeed(await loadVesselSigningSeed());
        // The head reads off the store's one holder — the standing vessel's replica when one stands.
        const resolveHeadOpKey = async (p: string): Promise<string | null> => {
          const head = (await storeVerb("persona-kel-head", { prefix: p })).output["head"];
          return typeof head === "string" ? head : null;
        };
        // M12′ — the SAME board read also carries the head's KEL seq (store-door-verbs.ts); feeding it through
        // lets `recordAdmittedPersona` order a real re-admission causally instead of falling to the nonce
        // tiebreak on every open. ADVISORY ONLY — `openPersonaGrant` never gates on it.
        const resolveHeadSeq = async (p: string): Promise<number | null> => {
          const seq = (await storeVerb("persona-kel-head", { prefix: p })).output["seq"];
          return typeof seq === "number" ? seq : null;
        };
        const r = await openAdmitFlow({ grantCarriage, resolveHeadOpKey, deviceSigner, resolveHeadSeq });
        if ("error" in r) throw new UsageError(r.error);
        emit(args, {
          ok: true,
          data: { carriage: r.carriage, personaPrefix: r.joinRecord.personaRef.prefix },
          human: () => {
            console.log(`admitted persona ${r.joinRecord.personaRef.prefix} onto this vessel (recorded locally, never synced).`);
            printHop(args, "acknowledgement (hand QR#3 back to the granting vessel to close the join)", r);
          },
        });
        return 0;
      }
      case "accept": {
        const ackCarriage = String(args.options["ack"] ?? "");
        if (!ackCarriage) throw new UsageError("accept needs --ack <carriage> (the target's QR#3)");
        const r = await acceptAdmitFlow({ ackCarriage });
        if ("error" in r) throw new UsageError(r.error);
        emit(args, {
          ok: true,
          data: { personaPrefix: r.joinRecord.personaRef.prefix, targetVesselId: r.joinRecord.targetVesselId },
          human: () => {
            console.log(`join CLOSED — persona ${r.joinRecord.personaRef.prefix} now stands admitted on vessel ${r.joinRecord.targetVesselId.slice(0, 16)}….`);
            console.log(`  both vessels hold the matching mutually-signed record (recorded locally on each, never synced).`);
          },
        });
        return 0;
      }
      case "list": {
        const admitted = listAdmittedPersonas();
        emit(args, {
          ok: true,
          data: { admitted: admitted.map((j) => ({ prefix: j.personaRef.prefix, targetVesselId: j.targetVesselId, expiry: j.expiry })) },
          human: () => {
            console.log(`personas admitted to THIS vessel (${admitted.length}) — the per-vessel multitude-view (never federates):`);
            for (const j of admitted) console.log(`  ${j.personaRef.prefix}  → vessel ${j.targetVesselId.slice(0, 16)}…  (granter ${j.granterKey.slice(0, 16)}…)`);
            if (admitted.length === 0) console.log(`  (none — admit one with the offer → grant → open → accept 3-hop)`);
          },
        });
        return 0;
      }
      case "reset": {
        clearPersonaAdmitPending();
        emit(args, { ok: true, data: { reset: true }, human: () => console.log("dropped any in-flight pending enrollment / grant secrets.") });
        return 0;
      }
      case "withdraw-offer": {
        const all = args.flags["all"] === true;
        const ephemeral = String(args.options["ephemeral"] ?? "");
        if (!all && !ephemeral) throw new UsageError("withdraw-offer needs --ephemeral <pubkey> or --all");
        const dropped = withdrawOfferFlow(all ? "all" : ephemeral);
        emit(args, {
          ok: true,
          data: { withdrawn: dropped },
          human: () => console.log(`withdrew ${dropped} pending offer${dropped === 1 ? "" : "s"} — a grant answering ${all ? "any of them" : "it"} now finds no pending enrollment.`),
        });
        return 0;
      }
      case "withdraw-grant": {
        const nonceA = String(args.options["nonce"] ?? "");
        if (!nonceA) throw new UsageError("withdraw-grant needs --nonce <nonceA> (the sent grant's own nonce)");
        const withdrawn = withdrawGrantFlow(nonceA);
        emit(args, {
          ok: true,
          data: { withdrawn },
          human: () => console.log(withdrawn
            ? "withdrew the sent grant — a late ACK against it now finds no sent memo to verify against."
            : "no sent grant stood at that nonce (already accepted, already withdrawn, or never sent)."),
        });
        return 0;
      }
      default:
        if (op) console.error(`lares persona admit: unknown op "${op}"`);
        admitUsage();
        return 2;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares persona admit ${op ?? ""}: ${msg}`) });
    return exitFor(code);
  }
}
