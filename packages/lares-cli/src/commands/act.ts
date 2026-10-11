/**
 * `lares act <VERB> [flags...]` — Residency Model ACTION verb operator surface.
 *
 * VERB ∈ { ADD, COPY, MOVE, CLEAR, DROP, LOAD, CREATE } ∪ { REPACK }
 *
 * Args per verb (kebab-case CLI flags):
 *
 *   REPACK
 *     --source <file>   the disk bundle (.json / .multids) whose pack the island collects
 *     --from <bag>      the bag holding the pack's members (their aside provenance)
 *     --out <file>      (optional) where the re-rendered bundle lands; defaults to --source
 *     --in-wiki         render through the active wiki island's composite layer stack
 *
 *   ADD / COPY / MOVE
 *     --title <t>       tiddler title (Work-level identity)
 *     --from <bag>      source bag URI
 *     --to <bag>        destination bag URI
 *     --change-id <id>  (optional) explicit change-id; defaults to newChangeId()
 *
 *   CLEAR / DROP
 *     --bag <bag>       target bag URI
 *
 *   LOAD
 *     --source-uri <u>  external content source (https://... etc.)
 *     --to <bag>        destination bag URI
 *     --change-id <id>  (optional) explicit change-id; defaults to newChangeId()
 *
 * Common flags:
 *   --yes             skip confirmation prompt
 *
 * Each invocation submits a verb-tiddler to the daemon vessel; the wiki island's
 * action-handler family executes the residency mutation wrapped in
 * withEffectRecord (writes the archival audit tiddlers).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { join, extname, resolve, relative, sep } from "node:path";
import { statSync, readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { larRoot, vesselDid } from "../env.js";
import { readCarrierText, fileToUriForSource } from "../ingest-core.js";
import { stageBodyToCas, carrierCasFlagged, declaredType } from "../cas-stage.js";
import { ACTION_VERBS, isActionVerb, isTransferVerb, isBagVerb, newChangeId, newRequestId, taskContentId, OUTCOME_URI_PREFIX } from "@lararium/mesh";
import { summaryOutput, type SubmitResult } from "../verb-result.js";
import { runVerb } from "../verb-call.js";
import { LocalWaitExpired, queryReceipt, type ReceiptAnswer } from "../local-connector.js";
import { verbFailure } from "../verb-call.js";
import { emit, wantsJson, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/**
 * A receipt's `done`/`error` reads exactly like `runVerb`'s own resolved result — build that shape
 * so the read-back's caller falls through the SAME ordinary-result handling below. `committed` (no
 * outcome yet), `abandoned` (refused before commit), and `unknown` (this vessel never arbitrated it
 * — a restart, most likely) carry no such shape; the caller still owes its own "outcome unknown" telling.
 */
function receiptToResult(r: ReceiptAnswer): SubmitResult | undefined {
  if (r.state !== "done" && r.state !== "error") return undefined;
  const out: { status: "done" | "error"; requestId: string; results?: SubmitResult["results"]; errorMessage?: string } = {
    status: r.state, requestId: r.requestId,
  };
  if (r.results !== undefined) out.results = r.results as SubmitResult["results"];
  if (r.errorMessage !== undefined) out.errorMessage = r.errorMessage;
  return out as SubmitResult;
}

/**
 * The loci title a LOADed file carries — used when the file is NOT a memetic
 * carrier (a memetic carrier self-titles from its own heading; this rides as the
 * fallback baseUri). Two derivations:
 *   1. A file under a `bags/<holding>/…` or `wikis/<slug>/…` mirror tree carries
 *      its stable lar: name — the interior after the holding dir, any extension
 *      stripped, when it bears a `w.w.w` loci root.
 *   2. Otherwise the file namespaces under the destination bag by its path
 *      relative to the LOAD source (extension stripped) — unique + projectable.
 */
function lociTitleForLoad(source: string, file: string, toBag: string): string {
  const parts = resolve(file).split(sep);
  for (const plane of ["bags", "wikis"]) {
    const i = parts.lastIndexOf(plane);
    if (i >= 0 && i + 2 < parts.length) {
      const interior = parts.slice(i + 2).join("/").replace(/\.[^/.]+$/, "");
      if (/^\w+\.\w+\.\w+\//.test(interior)) return `lar:///${interior}`;
    }
  }
  const rel = relative(source, file).split(sep).join("/").replace(/\.[^/.]+$/, "");
  const base = toBag.replace(/\/+$/, "");
  return rel ? `${base}/${rel}` : base;
}

function printUsage(): void {
  console.error("usage: lares act <VERB> [flags...]");
  console.error("");
  console.error(`  VERB ∈ { ${ACTION_VERBS.join(", ")}, REPACK }`);
  console.error("");
  console.error("  ADD / COPY / MOVE  --title <t> --from <bag> --to <bag> [--change-id <id>]");
  console.error("  CLEAR / DROP       --bag <bag>");
  console.error("  LOAD               --source-uri <u> --to <bag> [--change-id <id>]");
  console.error("  REPACK             --source <bundle-file> --from <bag> [--out <file>] [--in-wiki]");
  console.error("");
  console.error("  --yes              skip confirmation prompt");
}

/**
 * REPACK — the collect-the-residency EXPORT, seated with the rail.
 *
 * A multi-tiddler bundle (a `.json` array of tiddlers, or a `.multids`) rides as a PACK — one file,
 * many tiddlers — whose membership rides ASIDE in the bag's `$:/config/OriginalTiddlerPaths` (never on
 * the tiddlers). REPACK asks the island to collect the pack's members from that aside map and re-render
 * the bundle via TW5's OWN serializer, then writes the bytes back to disk — the deliberate round-trip a
 * foreign bundle takes before the operator opens an upstream TW5 PR (the `.mem` path auto-recomposes; a
 * foreign pack re-renders only on this verb).
 *
 * The island registers it as a QUERY verb (read cap, no residency mutation, no effect record), so it
 * rides beside `ACTION_VERBS` here rather than inside them: the rail's confirm prompt and content-
 * addressed request id guard a MUTATION, and a read that re-renders bytes the operator already holds
 * owes neither.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/pack-model
 */
async function actRepack(args: ParsedArgs): Promise<number> {
  const source  = args.options["source"];
  const fromBag = args.options["from"];
  if (!source || !fromBag) { printUsage(); return 2; }
  const out = args.options["out"] ?? source;

  const root = larRoot();
  // Derive the pack path (mirror-relative, WITH extension) exactly as the island recorded it in the
  // aside provenance: the loci URI's path + the file's extension.
  const uri = fileToUriForSource(root, source)(root, source);
  if (!uri || !uri.startsWith("lar:///")) {
    emit(args, { ok: false, error: { code: "usage", message: `no loci derivation for "${source}" (outside bags//wikis/, or rootless)` }, human: () => console.error(`lares act REPACK: no loci derivation for "${source}"`) });
    return exitFor("usage");
  }
  const packPath = uri.slice("lar:///".length) + extname(source);

  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares act REPACK: ${msg}`) });
    return exitFor("not-found");
  }

  // --in-wiki: run REPACK IN the active wiki island, so the members render through THAT wiki's
  // composite layer stack — the SAME bundle of titles renders distinctly per wiki (shadowing edits
  // above the canon), on purpose. The default path resolves daemon-side (canon bags, no working-layer
  // shadow).
  const inWiki     = Boolean(args.flags["in-wiki"]);
  const repackArgs = { bag: fromBag, "pack-path": packPath };
  const submitName = inWiki ? "wiki-act" : "REPACK";
  const submitArgs = inWiki ? { verb: "REPACK", args: repackArgs } : repackArgs;

  // A caller-generated nonce, before dispatch — the one thing a short read-back below can trust across
  // a lost response (see the LOAD arm further down for the full reasoning).
  const repackRequestId = newRequestId();
  let result;
  try {
    result = await runVerb(submitName, submitArgs, did, { requestId: repackRequestId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // THE SAME TWO FAULTS, TOLD APART. REPACK rides the default budget rather than a derived one, so its
    // outcome-unknown hint names the gesture instead of an arithmetic — but the split holds: a caller
    // told to stand a daemon that already stands loses the trail to the real fault either way.
    if (err instanceof LocalWaitExpired) {
      // THE SAME READ, NEVER A SECOND DISPATCH (H1) — `queryReceipt` rides a dedicated `{op:"receipt"}`
      // line the vessel answers from its own ledger + durable outcome doc; it cannot re-run the act.
      let receipt: ReceiptAnswer | undefined;
      try { receipt = await queryReceipt(repackRequestId); }
      catch { /* still unknown */ }
      const readBack = receipt ? receiptToResult(receipt) : undefined;
      if (readBack) {
        result = readBack;
      } else {
        if (receipt?.state === "abandoned") {
          const hint = "this vessel already refused this request before commit — it never ran. Re-run to try again.";
          emit(args, { ok: false, requestId: repackRequestId, error: { code: "request-abandoned", message: msg, hint }, human: () => { console.error(`lares act REPACK: request abandoned. Check request ${repackRequestId}.`); console.error(`  ${hint}`); } });
          return exitFor("request-abandoned");
        }
        const hint = "the daemon answered and this process stopped waiting; a short read found no receipt yet. The verb may still be running. Re-run on a quieter machine, or repack a smaller bundle — the same request id reads the receipt back once it lands.";
        emit(args, { ok: false, requestId: repackRequestId, error: { code: "outcome-unknown", message: msg, hint }, human: () => { console.error(`lares act REPACK: outcome unknown. Check request ${repackRequestId}.`); console.error(`  ${hint}`); } });
        return exitFor("outcome-unknown");
      }
    } else {
      // M3′: told apart by the error's own TYPE — a genuinely absent daemon is the ONE fault this
      // standing hint cures; anything else (a transport-level verb-error) keeps its own words.
      const f = verbFailure(err);
      emit(args, { ok: false, error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) }, human: () => { console.error(`lares act REPACK: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); } });
      return exitFor(f.code);
    }
  }
  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    const code = /^cap-denied/.test(msg) ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: msg }, human: () => console.error(`REPACK failed: ${msg}`) });
    return exitFor(code);
  }

  const summary = summaryOutput(result) ?? {};
  const text    = typeof summary["text"] === "string" ? (summary["text"] as string) : "";
  const count   = summary["count"] ?? 0;
  const missing = summary["missing"];
  writeFileSync(out, text, "utf-8");
  emit(args, {
    ok: true, requestId: result.requestId,
    data: { verb: "REPACK", pack: packPath, out, count, ...(missing ? { missing } : {}) },
    human: () => {
      console.log(`REPACK ✓ ${count} member(s) → ${out}`);
      if (Array.isArray(missing) && missing.length > 0) console.error(`  ⚠ ${missing.length} member(s) missing (tombstoned): ${(missing as string[]).join(", ")}`);
    },
  });
  return 0;
}

export async function cmdAct(args: ParsedArgs): Promise<number> {
  const verbRaw = args.positional[0];
  if (!verbRaw) { printUsage(); return 2; }
  if (verbRaw === "REPACK") return await actRepack(args);
  if (!isActionVerb(verbRaw)) {
    console.error(`lares act: "${verbRaw}" is not an ACTION verb`);
    console.error(`  ACTION verbs: ${ACTION_VERBS.join(", ")}, REPACK`);
    return 2;
  }
  if (verbRaw === "INGEST") {
    console.error("lares act INGEST: the ingest gesture carries hashes the act surface does not — use `lares ingest --source <dir> --to <bag>`");
    return 2;
  }
  const verb = verbRaw;

  // Build the kebab-case args bag per residency-actions encoding.
  const actionArgs: Record<string, unknown> = {};
  let carrierCount = 0;
  if (isTransferVerb(verb)) {
    const title    = args.options["title"];
    const fromBag  = args.options["from"];
    const toBag    = args.options["to"];
    const changeId = args.options["change-id"] ?? newChangeId();
    if (!title || !fromBag || !toBag) {
      console.error(`lares act ${verb}: --title, --from, --to all required`);
      return 2;
    }
    actionArgs["title"]      = title;
    actionArgs["from-bag"]   = fromBag;
    actionArgs["to-bag"]     = toBag;
    actionArgs["change-id"]  = changeId;
  } else if (isBagVerb(verb)) {
    const bag = args.options["bag"];
    if (!bag) {
      console.error(`lares act ${verb}: --bag required`);
      return 2;
    }
    actionArgs["bag"] = bag;
  } else if (verb === "CREATE") {
    const bag = args.options["bag"];
    if (!bag) {
      console.error(`lares act CREATE: --bag required`);
      return 2;
    }
    // `--plane <catalog|oracle>` names the target oracle plane: catalog = the private user/household
    // plane (default), oracle = the system/temple plane. The three-plane model's public plane
    // (crossroads) is not yet a live `act` target; it joins this set when the public plane wires in.
    // An unrecognized value errors rather than silently coercing to catalog (a typo would mis-place the bag).
    const planeOpt = args.options["plane"];
    if (planeOpt !== undefined && planeOpt !== "catalog" && planeOpt !== "oracle") {
      console.error(`lares act CREATE: --plane must be "catalog" or "oracle" (got "${planeOpt}")`);
      return 2;
    }
    const plane = planeOpt === "oracle" ? "oracle" : "catalog";
    actionArgs["bag"]   = bag;
    actionArgs["plane"] = plane;
  } else {
    // verb === "LOAD"
    const sourceUri = args.options["source-uri"];
    const toBag     = args.options["to"];
    const changeId  = args.options["change-id"] ?? newChangeId();
    if (!sourceUri || !toBag) {
      console.error(`lares act LOAD: --source-uri and --to required`);
      return 2;
    }
    actionArgs["source-uri"] = sourceUri;
    actionArgs["to-bag"]     = toBag;
    actionArgs["change-id"]  = changeId;

    // The disk grant lives HERE — the operator gesture reads the carriers and
    // sends content WITH the verb (islands hold no fetch capability). A local
    // carrier file, or a directory of them, packs into args.carriers.
    try {
      const st = statSync(sourceUri);
      const isDir = st.isDirectory();
      const paths = (isDir
        ? (readdirSync(sourceUri, { recursive: true }) as string[])
            .map((f) => join(sourceUri, f))
            .filter((f) => { try { return statSync(f).isFile(); } catch { return false; } })
        : [sourceUri])
        // A `.meta` sidecar rides WITH its content file, never as a carrier of its own.
        .filter((f) => !f.endsWith(".meta"));
      // The feed lands BOTH memetic-wikitext memes AND every other legal TW5
      // filetype: each carrier rides its text + a loci title + its extension, and
      // the island routes by content (an SOH heading → the memetic shore; else
      // TW5's own deserializer registry, keyed by extension). Only an empty /
      // whitespace-only file is skipped — it holds no carrier and would reject the
      // whole batch (the validator forbids an empty-text carrier). A binary
      // filetype (image/PDF) rides base64 to the CAS stager, which decodes it and
      // stages the raw bytes as a POINTER; a text filetype rides utf8.
      const carriers = paths
        .map((f) => { const r = readCarrierText(f); return { f, text: r.text, binary: r.binary }; })
        .filter(({ f, text }) => {
          if (text.trim().length === 0) {
            console.error(`lares act LOAD: skipping empty file "${f}" — no content to land`);
            return false;
          }
          return true;
        })
        .map(({ f, text, binary }) => {
          // Pair a `.meta` sidecar so a content filetype keeps its fields at the shore.
          let meta: string | undefined;
          try { if (existsSync(f + ".meta")) meta = readFileSync(f + ".meta", "utf8"); } catch { /* none */ }
          // THE BLOB LAW (cas-stage.ts): a pointer-kind `type` (the `.meta` declaration first, else
          // TW5's registry by extension) or the `_lar_cas` flag stages the body to the corpus CAS and
          // rides a skinny `textCid`, landing island-side as a POINTER (body stays in CAS); a utf8 body
          // under the wall rides INLINE.
          const ext = extname(f);
          const flagged = carrierCasFlagged(text, meta);
          const type = declaredType(meta);
          const staged = stageBodyToCas(text, { ext, flagged, binary, ...(type ? { type } : {}) });
          return {
            size: staged.size, title: lociTitleForLoad(sourceUri, f, toBag), ext,
            ...(staged.staged ? { textCid: staged.cid } : { text }),
            ...(staged.skinny ? { skinny: true } : {}),
            ...(meta !== undefined ? { meta } : {}),
          };
        });
      if (carriers.length > 0) {
        actionArgs["carriers"] = carriers;
        carrierCount = carriers.length;
      }
    } catch {
      // Honesty at the gesture: a non-resolving local path probably means a
      // typo — the island will refuse a carrier-less LOAD loudly either way.
      console.error(`lares act LOAD: "${sourceUri}" does not resolve locally — sending provenance-only LOAD (no carriers)`);
    }
  }

  // --dry-run / preview: capture the projected effect, commit nothing. Rides the
  // raw args; the island reactor reads it and runs the verb through a capturing access.
  if (args.flags["dry-run"]) actionArgs["dry-run"] = true;

  // ── Operator identity ─────────────────────────────────────────────────

  let did: string;
  try {
    did = await vesselDid();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares act: ${msg}`) });
    return exitFor("not-found");
  }

  // ── Confirm (HUMAN/TTY path only; agents carry --yes) ─────────────────
  // An agent (JSON / off-TTY) cannot answer y/N — it MUST carry intent via --yes;
  // refusing the prompt keeps the surface non-interactive for unattended actors.
  if (!args.flags["yes"] && !args.flags["dry-run"]) {
    if (wantsJson(args)) {
      emit(args, {
        ok: false, error: { code: "usage", message: "confirmation required", hint: "pass --yes for non-interactive (agent) invocation" },
        human: () => { /* unreachable on the JSON path */ },
      });
      return exitFor("usage");
    }
    console.log("");
    console.log(`  ${verb}`);
    for (const [k, v] of Object.entries(actionArgs)) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
    console.log("");
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("Proceed? [y/N] ");
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log("aborted");
      return 1;
    }
  }

  // ── Submit (UDS fast path, WS fallback — the lares↔lararium binding) ───
  // V1 — content-address this idempotent residency change (empty nonce). The
  // subject names the bag the change lands in; re-issuing the SAME logical change
  // (same change-id + verb + target) collapses to one requestId, and the
  // dispatcher's outcome-keyed dedup then gives exactly-once EFFECT. A fresh
  // change-id (the --change-id default) means a genuinely distinct change → runs.
  const subject   = String(actionArgs["to-bag"] ?? actionArgs["bag"] ?? "");
  // --in-wiki: run the ACTION IN the active wiki island over ITS composite
  // (where working + canon both live) — the daemon commands via `wiki-act`,
  // never reaching the per-fingerprint working binding. The default path
  // executes daemon-side (write-then-sync).
  const inWiki     = Boolean(args.flags["in-wiki"]);
  const submitName = inWiki ? "wiki-act" : verb;
  const submitArgs = inWiki ? { verb, args: actionArgs } : actionArgs;
  const requestId = await taskContentId({ subject, command: submitName, args: submitArgs, nonce: "" });
  // The ACK budget scales with the gesture: a directory-batch LOAD chews one
  // island frame per carrier, so a flat budget times out the ACK while the verb
  // itself succeeds.
  const timeoutMs = Math.max(10_000, 10_000 + carrierCount * 400);
  // ONE SHORT READ-BACK, BY THE SAME REQUEST ID, THROUGH `queryReceipt` — A READ, NEVER A SECOND
  // DISPATCH (H1). This used to re-submit through `runVerb` a second time, trusting the dispatcher's
  // outcome dedup to make that safe — but an id this vessel had already dropped as ABANDONED (the
  // caller gave up before the vessel ever committed) carried no outcome to dedup against, so the
  // "read-back" ran the act a second time under the SAME id. `queryReceipt` rides a dedicated
  // `{op:"receipt"}` line the vessel answers from its own ledger + durable outcome doc alone — it
  // cannot dispatch anything, by construction.
  const READBACK_MS = 2_000;
  let result;
  try {
    result = await runVerb(submitName, submitArgs, did, { requestId, timeoutMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A LOCAL WAIT ENDING IS NOT A VERDICT ON THE ACT, AND NEVER AN ABSENT DAEMON. The socket connected and
    // the daemon took the verb; this process merely stopped waiting to hear back. Naming that
    // `daemon-unreachable` sends an operator to start something already running, and `verb-timeout` tells an
    // agent the act failed when it may have committed. So this reports "outcome unknown" and tries ONE short
    // read-back by the same request id before giving up on knowing at all.
    if (err instanceof LocalWaitExpired) {
      let receipt: ReceiptAnswer | undefined;
      try { receipt = await queryReceipt(requestId, { patienceMs: READBACK_MS }); }
      catch { /* still unknown — the read itself may fail too (daemon gone between writes) */ }
      const readBack = receipt ? receiptToResult(receipt) : undefined;
      if (readBack) {
        result = readBack; // a receipt landed meanwhile — fall through to the ordinary result handling below
      } else if (receipt?.state === "abandoned") {
        // M3′: its own code, never `outcome-unknown` — this vessel has already settled the
        // question "did it run"; the answer is no, and it never will under this id.
        const hint = "this vessel already refused this request before commit — it never ran. Re-run to try again.";
        emit(args, {
          ok: false, requestId, error: { code: "request-abandoned", message: msg, hint },
          human: () => { console.error(`lares act: request abandoned. Check request ${requestId}.`); console.error(`  ${hint}`); },
        });
        return exitFor("request-abandoned");
      } else {
        const perCarrier = "10s + 400ms per carrier";
        const hint = `this process stopped waiting after ${timeoutMs}ms (a LOAD of ${carrierCount} carrier(s) budgets ${perCarrier}) and a ${READBACK_MS}ms read found no receipt yet. The verb may still be running. Its content-addressed request id (${requestId}) is deterministic from these same args, so re-running this exact command later reads the same receipt back once it lands rather than running the act twice — the dispatcher's outcome dedup makes the re-issue safe. The outcome, once written, lives at ${OUTCOME_URI_PREFIX}${requestId}.`;
        emit(args, {
          ok: false, requestId, error: { code: "outcome-unknown", message: msg, hint },
          human: () => { console.error(`lares act: outcome unknown. Check request ${requestId}.`); console.error(`  ${hint}`); },
        });
        return exitFor("outcome-unknown");
      }
    } else {
      // M3′: told apart by the error's own TYPE — "nothing answered" is the one fault the standing
      // hint actually cures; anything else keeps its own words rather than borrowing that advice.
      const f = verbFailure(err);
      emit(args, {
        ok: false, error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
        human: () => { console.error(`lares act: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
      });
      return exitFor(f.code);
    }
  }
  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    // The island names a cap/ward denial as `cap-denied: …`; give it its own
    // class (exit 5) so an agent can tell "I lack authority" from a plain
    // verb failure. Everything else stays a verb-error (exit 4).
    const code = /^cap-denied/.test(msg) ? "cap-denied" : /conflict/i.test(msg) ? "conflict" : "verb-error";
    emit(args, {
      ok: false, requestId: result.requestId, error: { code, message: msg },
      human: () => console.error(`${verb} failed: ${msg}`),
    });
    return exitFor(code);
  }

  const summary = summaryOutput(result) ?? {};
  const auditUri = `${OUTCOME_URI_PREFIX}${result.requestId}`;
  emit(args, {
    ok: true,
    requestId: result.requestId,
    data: { verb, ...summary, audit: auditUri },
    human: () => {
      if (summary["dryRun"]) {
        const wl = Array.isArray(summary["wouldLand"]) ? summary["wouldLand"].length : 0;
        const wt = Array.isArray(summary["wouldTombstone"]) ? summary["wouldTombstone"].length : 0;
        console.log(`${verb} --dry-run: would land ${wl}, tombstone ${wt} — NOTHING committed (req ${result.requestId.slice(0, 8)})`);
      } else {
        console.log(`${verb} ✓ applied locally (req ${result.requestId.slice(0, 8)})`);
      }
      for (const [k, v] of Object.entries(summary)) {
        console.log(`  ${k.padEnd(12)} ${typeof v === "string" ? v : JSON.stringify(v)}`);
      }
      console.log(`  audit:       ${auditUri}`);
    },
  });
  return 0;
}
