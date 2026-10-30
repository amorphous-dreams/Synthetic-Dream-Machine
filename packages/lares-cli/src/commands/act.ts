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
import { larRoot, larBagsDir, larWikisDir, vesselDid } from "../env.js";
import { readCarrierText, fileToUriForSource } from "../ingest-core.js";
import { stageBodyToCas, carrierCasFlagged, declaredType } from "../cas-stage.js";
import { ACTION_VERBS, isActionVerb, isTransferVerb, isBagVerb, newChangeId, newRequestId, taskContentId, OUTCOME_URI_PREFIX, wikiSlugOfBag } from "@lararium/mesh";
import { summaryOutput, type SubmitResult } from "../verb-result.js";
import { runVerb } from "../verb-call.js";
import { LocalWaitExpired, queryReceipt, type ReceiptAnswer } from "../local-connector.js";
import { verbFailure, refusalCode, refusalHint } from "../verb-call.js";
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
 * The `lar:` title a LOADed file carries — used when the file is NOT a memetic
 * carrier (a memetic carrier self-titles from its own heading; this rides as the
 * fallback baseUri). Two derivations:
 *   1. A file under a `bags/<holding>/…` or `wikis/<slug>/…` mirror tree carries
 *      its stable lar: name — the interior after the holding dir, any extension
 *      stripped, when it bears a `w.w.w` address root.
 *   2. Otherwise the file namespaces under the destination bag by its path
 *      relative to the LOAD source (extension stripped) — unique + projectable.
 */
function addressTitleForLoad(source: string, file: string, toBag: string): string {
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
  console.error("  MOVE of a tombstone  --title <t> --from <bag> [--to <bag>] [--shadow]");
  console.error("                     carries the delete down into a bag that holds the title; with no --to the");
  console.error("                     holders print as candidates; --shadow hides the title from a bag that holds none");
  console.error("  CLEAR / DROP       --bag <bag> [--change-id <id>]");
  console.error("  CREATE             --bag <bag> [--plane <catalog|oracle>] [--change-id <id>]");
  console.error("  LOAD               --source-uri <u> --to <bag> [--change-id <id>]");
  console.error("  REPACK             --source <bundle-file> --from <bag> [--out <file>]");
  console.error("");
  console.error("  --yes              skip confirmation prompt");
  console.error("  --dry-run          preview the effect without committing it");
  console.error("  --in-wiki          run any act in the active wiki");
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
  // aside provenance: the `lar:` URI's path + the file's extension.
  const uri = fileToUriForSource(root, source, { bags: larBagsDir(), wikis: larWikisDir() })(root, source);
  if (!uri || !uri.startsWith("lar:///")) {
    emit(args, { ok: false, error: { code: "usage", message: `no address derivation for "${source}" (outside bags//wikis/, or rootless)` }, human: () => console.error(`lares act REPACK: no address derivation for "${source}"`) });
    return exitFor("usage");
  }
  const packPath = uri.slice("lar:///".length) + extname(source);

  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares act REPACK: ${msg}`) });
    return exitFor("not-found");
  }

  const repackArgs = { bag: fromBag, "pack-path": packPath };

  // REPACK READS — it registers as a QUERY verb (no residency mutation, no effect record), so it
  // carries NO effectKey (H7). An effect-dedup key names a MUTATION this attempt would produce; a
  // read produces none, and a re-render from the same aside provenance is always safe to repeat —
  // there is no "ran twice" to guard against. Only `requestId` rides, a fresh nonce every attempt.
  const repackRequestId  = newRequestId();
  const submitName = args.flags["in-wiki"] ? "wiki-act" : "REPACK";
  const submitArgs = args.flags["in-wiki"] ? { verb: "REPACK", args: repackArgs } : repackArgs;
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
          const hint = refusalHint("request-abandoned", undefined)!;
          emit(args, { ok: false, requestId: repackRequestId, error: { code: "request-abandoned", message: msg, hint }, human: () => { console.error(`lares act REPACK: request abandoned. Check request ${repackRequestId}.`); console.error(`  ${hint}`); } });
          return exitFor("request-abandoned");
        }
        if (receipt?.state === "interrupted") {
          const hint = refusalHint("request-interrupted", undefined)!;
          emit(args, { ok: false, requestId: repackRequestId, error: { code: "request-interrupted", message: msg, hint }, human: () => { console.error(`lares act REPACK: request interrupted. Check request ${repackRequestId}.`); console.error(`  ${hint}`); } });
          return exitFor("request-interrupted");
        }
        const hint = `this process stopped waiting after the daemon answered; a short read found no receipt yet for THIS attempt's own request id (${repackRequestId}) — check it with \`lares receipt ${repackRequestId}\`. REPACK reads and carries no effect key — re-running it is always safe, since there is nothing it could re-land twice.`;
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
    const code = result.refusal?.reason !== undefined
      ? refusalCode(result.refusal.reason)
      : /^cap-denied/.test(msg) ? "cap-denied" : "verb-error";
    const hint = refusalHint(code, undefined);
    emit(args, {
      ok: false, requestId: result.requestId ?? repackRequestId, error: { code, message: msg, ...(hint !== undefined ? { hint } : {}) },
      human: () => { console.error(`REPACK failed: ${msg}`); if (hint !== undefined) console.error(`  ${hint}`); },
    });
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

/**
 * `heard` hands an in-process caller (the seed) the island's own answer for a landed act (the emitted `data`:
 * a LOAD's `titles`, a dry run's `wouldLand`), beside the exit code the CLI face returns. CLI parsing never supplies it.
 */
export async function cmdAct(args: ParsedArgs, heard?: (data: Record<string, unknown>) => void): Promise<number> {
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
  // `changeId` is EVERY verb's own CHANGE nonce (H7/M10) — the identity of the logical change an
  // operator intends, told apart from `requestId` (a fresh dispatch attempt) below. ADD/COPY/MOVE
  // and LOAD already ride it on the wire as part of `actionArgs` (it names which Work moves where);
  // CLEAR/DROP/CREATE have no such content to distinguish one change from the next, so `--change-id`
  // rides CLI-side only, folded into the effect key's own nonce — it never reaches the wire args
  // (no mesh change). `nonce` is that fold: `""` for a verb whose wire args already carry the
  // change's identity (a re-send of identical args IS a re-send of the identical change, so the
  // content-addressed effectKey needs no extra salt); `changeId` itself for a verb whose wire args
  // carry none, so two DISTINCT changes to the same bag (two separate CLEARs) must not collapse onto
  // one effectKey merely because `{bag:...}` reads the same both times.
  let changeId: string;
  let nonce = "";
  if (isTransferVerb(verb)) {
    const title    = args.options["title"];
    const fromBag  = args.options["from"];
    const toBag    = args.options["to"];
    changeId = args.options["change-id"] ?? newChangeId();
    if (!title || !fromBag || (verb !== "MOVE" && !toBag)) {
      console.error(`lares act ${verb}: --title, --from, --to all required`);
      return 2;
    }
    if (verb !== "MOVE" && args.flags["shadow"]) {
      console.error(`lares act ${verb}: --shadow rides a MOVE of a tombstone alone`);
      return 2;
    }
    if (verb === "MOVE" && !toBag) {
      try {
        const did = await vesselDid();
        const where = await runVerb("where", { tiddler: title }, did);
        const holders = ((summaryOutput(where)?.["bags"] ?? []) as string[]);
        if (holders.includes(fromBag)) {
          console.error("lares act MOVE: --title, --from, --to all required");
          return 2;
        }
        console.log("bags holding the title:");
        for (const bag of holders.filter((candidate) => candidate !== fromBag)) console.log(bag);
        console.log("name the bag where the delete takes place with --to <bag>");
      } catch (err) {
        console.error(`lares act MOVE: could not read the bags holding ${title}: ${err instanceof Error ? err.message : String(err)}`);
        return 4;
      }
      return 2;
    }
    actionArgs["title"]      = title;
    actionArgs["from-bag"]   = fromBag;
    actionArgs["to-bag"]     = toBag;
    actionArgs["change-id"]  = changeId;
    if (verb === "MOVE" && args.flags["shadow"]) actionArgs["shadow"] = true;
  } else if (isBagVerb(verb)) {
    const bag = args.options["bag"];
    if (!bag) {
      console.error(`lares act ${verb}: --bag required`);
      return 2;
    }
    changeId = args.options["change-id"] ?? newChangeId();
    nonce = changeId;
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
    changeId = args.options["change-id"] ?? newChangeId();
    nonce = changeId;
    actionArgs["bag"]   = bag;
    actionArgs["plane"] = plane;
  } else {
    // verb === "LOAD"
    const sourceUri = args.options["source-uri"];
    const toBag     = args.options["to"];
    changeId = args.options["change-id"] ?? newChangeId();
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
      // filetype: each carrier rides its text + a `lar:` title + its extension, and
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
            size: staged.size, title: addressTitleForLoad(sourceUri, f, toBag), ext,
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
  // An explicit --in-wiki ask uses the active wiki. A slot act without that ask
  // reaches the named wiki; other acts use the daemon's reach.
  // The daemon wiki stands on the daemon's own reach, never a wiki island, so its slots route nowhere.
  const slot = (bag: string): boolean => /^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/(?:temp|draft|personal|working)$/.test(bag) && wikiSlugOfBag(bag) !== "daemon";
  const wikiVerb = verb === "LOAD" || verb === "MOVE" || verb === "COPY" || verb === "ADD";
  const destinationWiki = wikiVerb && slot(subject) ? wikiSlugOfBag(subject) : null;
  const source = actionArgs["from-bag"];
  const sourceWiki = verb === "MOVE" && typeof source === "string" && slot(source)
    ? wikiSlugOfBag(source) : null;
  const explicitInWiki = args.flags["in-wiki"] === true;
  const wiki = explicitInWiki ? null : sourceWiki ?? destinationWiki;
  const inWiki = explicitInWiki || wiki !== null;
  const submitName = inWiki ? "wiki-act" : verb;
  const submitArgs = inWiki ? { verb, args: actionArgs, ...(wiki ? { wiki } : {}) } : actionArgs;
  // THE EFFECT NAMES WHAT RUNNING THIS WOULD DO, content-addressed — always computed, every verb.
  // EVERY action verb now SPLITS its id from it (E1 commit 4′, generalizing H4's LOAD-only fix,
  // D1 P2.5 iter 4 commit 4): `requestId` mints a FRESH nonce per attempt, so a retry after an
  // abandoned/unknown/evicted outcome actually dispatches again rather than reusing an id this
  // vessel may have already settled forever (the livelock H4 first named for LOAD applies equally
  // to a reused `--change-id` on ADD/COPY/MOVE, or a reused `--bag` on CLEAR/DROP/CREATE — any
  // content-addressed id, reused across an identical retry a frozen vessel invites, could never
  // again win "run" once this vessel had recorded it abandoned). `effectKey` still rides every
  // attempt, so the daemon's own effect index answers a repeat attempt that DID land with the
  // prior `done` outcome, never running the verb twice.
  const effectKey = await taskContentId({ subject, command: submitName, args: submitArgs, nonce });
  const requestId = newRequestId();
  // The ACK budget scales with the gesture: a directory-batch LOAD chews one
  // island frame per carrier, so a flat budget times out the ACK while the verb
  // itself succeeds.
  const timeoutMs = Math.max(10_000, 10_000 + carrierCount * 400);
  // ONE SHORT READ-BACK, BY THE SAME REQUEST ID, THROUGH `queryReceipt` — A READ, NEVER A SECOND
  // DISPATCH (H1). A re-submit through `runVerb` cannot stand in for it: the dispatcher's outcome dedup
  // holds nothing for an id this vessel dropped as ABANDONED (the caller gave up before the vessel ever
  // committed), so a re-submitting "read-back" runs the act a second time under the SAME id. `queryReceipt` rides a dedicated
  // `{op:"receipt"}` line the vessel answers from its own ledger + durable outcome doc alone — it
  // cannot dispatch anything, by construction.
  const READBACK_MS = 2_000;
  let result;
  try {
    result = await runVerb(submitName, submitArgs, did, { requestId, effectKey, timeoutMs });
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
        // question "did it run"; the answer is no, and it never will under this id. The hint text
        // lives in `refusalHint` (K2, P2.5 iteration 7) — the SAME helper the synchronous refusal
        // branch below calls for the identical code, so a caller reads one cure regardless of
        // which door (read-back here, or a live refusal) answered it.
        const hint = refusalHint("request-abandoned", changeId)!;
        emit(args, {
          ok: false, requestId, error: { code: "request-abandoned", message: msg, hint },
          human: () => { console.error(`lares act: request abandoned. Check request ${requestId}.`); console.error(`  ${hint}`); },
          data: { changeId },
        });
        return exitFor("request-abandoned");
      } else if (receipt?.state === "interrupted") {
        const hint = refusalHint("request-interrupted", changeId)!;
        emit(args, {
          ok: false, requestId, error: { code: "request-interrupted", message: msg, hint },
          human: () => { console.error(`lares act: request interrupted. Check request ${requestId}.`); console.error(`  ${hint}`); },
          data: { changeId },
        });
        return exitFor("request-interrupted");
      } else if (receipt?.state === "evicted") {
        // M1: the receipt ring dropped this id's outcome past its retention bound — its own code,
        // never a bare "unknown" that would invite a re-run to re-read a receipt that no longer
        // exists. Same shared helper as above.
        const hint = refusalHint("retention-gap", changeId)!;
        emit(args, {
          ok: false, requestId, error: { code: "retention-gap", message: msg, hint },
          human: () => { console.error(`lares act: retention gap. Check request ${requestId}.`); console.error(`  ${hint}`); },
          data: { changeId },
        });
        return exitFor("retention-gap");
      } else {
        // THE HINT MUST NEVER PROMISE WHAT THE SPLIT ID NO LONGER DOES (H4, generalized E1 commit
        // 4′), AND MUST NEVER CALL A FLAGLESS RE-RUN "SAFE" (M10) — a re-run that omits `--change-id`
        // mints a NEW change, which is exactly the double-run this hint exists to prevent. requestId
        // is now a FRESH nonce every verb's own attempt alone owns — re-running never reads IT back
        // (a fresh attempt mints its own) — so the hint names the EXACT gesture that keeps this a
        // retry rather than a new change: reuse `--change-id`.
        const hint = `this process stopped waiting after ${timeoutMs}ms (budgeted for ${carrierCount} carrier(s)${verb === "LOAD" ? " — a LOAD budgets 10s + 400ms per carrier" : ""}) and a ${READBACK_MS}ms read found no receipt yet for THIS attempt's own request id (${requestId}) — check it with \`lares receipt ${requestId}\`. Re-run with \`--change-id ${changeId}\`: if this attempt landed, the effect index answers it without running twice; a re-run WITHOUT it is a NEW change. The outcome, once written, lives at ${OUTCOME_URI_PREFIX}${requestId}.`;
        emit(args, {
          ok: false, requestId, error: { code: "outcome-unknown", message: msg, hint },
          human: () => { console.error(`lares act: outcome unknown. Check request ${requestId}.`); console.error(`  ${hint}`); },
          data: { changeId },
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
        data: { changeId },
      });
      return exitFor(f.code);
    }
  }
  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    // A LIVE DISPATCH's own channel refusal (D1, M3″) names its own reason — told apart by that
    // NAME, never by sniffing `msg` the way a cap/conflict denial still is below. This answers the
    // SAME-line refusal the catch above's read-back branches answer for a LOST connection's
    // after-the-fact receipt; here the socket never dropped, so the refusal rides back synchronously.
    const code = result.refusal?.reason !== undefined
      ? refusalCode(result.refusal.reason)
      // The island names a cap/ward denial as `cap-denied: …`; give it its own
      // class (exit 5) so an agent can tell "I lack authority" from a plain
      // verb failure. Everything else stays a verb-error (exit 4).
      : /^cap-denied/.test(msg) ? "cap-denied" : /conflict/i.test(msg) ? "conflict" : "verb-error";
    // K2, P2.5 iteration 7: this LIVE refusal carries the SAME cure the read-back branches above
    // carry for the identical code (`refusalHint`, shared) — a caller must never read a hint on the
    // lost-connection door and silence on this one for the identical refusal reason.
    const hint = refusalHint(code, changeId);
    emit(args, {
      ok: false, requestId: result.requestId, error: { code, message: msg, ...(hint !== undefined ? { hint } : {}) },
      human: () => { console.error(`${verb} failed: ${msg}`); if (hint !== undefined) console.error(`  ${hint}`); },
      data: { changeId },
    });
    return exitFor(code);
  }

  const summary = summaryOutput(result) ?? {};
  const auditUri = `${OUTCOME_URI_PREFIX}${result.requestId}`;
  // H7: `effectOf` surfaces when the daemon's own effect index answered THIS attempt with a PRIOR
  // attempt's landed outcome, rather than running the verb again — the CLI's own telling of "that
  // already landed" distinct from "I just landed it".
  const effectOf = result.effectOf;
  const data = { verb, ...summary, audit: auditUri, changeId, ...(effectOf !== undefined ? { effectOf } : {}) };
  heard?.(data);
  emit(args, {
    ok: true,
    requestId: result.requestId,
    data,
    human: () => {
      if (summary["dryRun"]) {
        const wl = Array.isArray(summary["wouldLand"]) ? summary["wouldLand"].length : 0;
        const wt = Array.isArray(summary["wouldTombstone"]) ? summary["wouldTombstone"].length : 0;
        console.log(`${verb} --dry-run: would land ${wl}, tombstone ${wt} — NOTHING committed (req ${result.requestId.slice(0, 8)})`);
      } else if (effectOf !== undefined) {
        console.log(`${verb} ✓ already landed by request ${effectOf} — not re-run (req ${result.requestId.slice(0, 8)})`);
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
