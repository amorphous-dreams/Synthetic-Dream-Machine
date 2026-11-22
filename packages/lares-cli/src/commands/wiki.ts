/**
 * `lares wiki <verb> [args...]` — operator surface for whole-wiki operations.
 *
 * Subcommand-style dispatcher. Mirrors `lares bag` shape; operates at the
 * recipe / wiki granularity rather than individual bags. End-user UI may
 * still call these "wikis" while the architectural noun stays "wiki"
 * (Kowloon wiki=Group mapping).
 *
 * Verbs (full E-arc surface ships; the `lares act` residency verbs land next):
 *   list / which / resolve   — read & inspect: enumerate, presence-query, coordinate-resolve
 *   init / open / sync       — lifecycle: mint, set-active, ingest memes
 *   retire                   — the owner face's unmint of a shell it minted by mistake (canon untouched)
 *   pin / unpin              — whole-recipe residency
 *   add-bag / remove-bag     — recipe composition (hot-reload via composite.addLayer)
 *   epoch / rotate-recipe    — bound history (snapshot-restart, Nix-generations)
 *   prune-stale              — surface stale drafts for residency-action-or-prune
 *   filter / render / status — THE TIDDLER DOOR's engine verbs (wiki-surface-scout, lane 1): run a TiddlyWiki
 *                              filter, wikify a title or a span, and read each layer's writeability for the
 *                              session's face, each in the wiki's own engine (`--recipe default` or any wiki the face reaches);
 *                              `lares tiddler get|put|delete` holds the record verbs
 */

import { vesselDid } from "../env.js";
import { emit, exitFor } from "../render.js";
import { summaryOutput, type SubmitResult, type SubmitOptions } from "../verb-result.js";
import { runVerb, runVerbAsFace, verbFailure } from "../verb-call.js";
import { faceOption, FaceOptionMalformed } from "../face-option.js";
import { cmdShare } from "./share-cmd.js";
import { ensureWikiRealm, labelRealmOf, LIVE_REALM_DOORS, placeWikiInRealm, releaseWikiRealm, setAsideWikiFolder, type RealmDoors } from "./realm-doors.js";
import { sealedAct } from "../sealed-act-door.js";
import { RealmRefused, loadLaresConfig, tempConsentedSlugs } from "@lararium/node";
import { wikiSlotKindOf } from "@lararium/mesh";
import { engineContainerArgs } from "../container-target.js";
import { DoorUsage, countOf, guardDoor, namesOf, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { targetOf } from "../target-option.js";
import { stdout } from "node:process";
import type { ParsedArgs } from "../parse-args.js";

type WikiSubcommand = (args: ParsedArgs) => Promise<number>;

// The whole wiki surface runs over the lares↔lararium binding: one line over the
// daemon's sock. `call` surfaces a transport failure as an error-result so each
// handler's `r.status === "error"` path reports it.
async function call(
  name: string,
  args: Record<string, unknown>,
  did:  string,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  try {
    return await runVerb(name, args, did, opts);
  } catch (err) {
    // M3′: this folded EVERY thrown fault — including a LOCAL WAIT ENDING with a real request id —
    // into a bare `{status:"error", requestId:""}`, so a caller could never tell "the daemon took it
    // and I stopped waiting" from "nothing ran" and lost the request id to read back. `verbFailure`
    // tells the fault apart by its own TYPE; the request id (when one exists) rides through.
    const f = verbFailure(err);
    return { status: "error", requestId: f.requestId ?? "", errorMessage: f.message };
  }
}

export async function cmdWikiList(args: ParsedArgs): Promise<number> {
  // EACH HAT REACHED BY NAME: `--face N` lists through a session of face N (the island answers the mount's catalog alone for
  // now, so a lit sibling refuses there by name); with none, the one-shot lists the worn face's. A shut face: `face-not-open`.
  let named: { face?: number };
  try { named = args.options["face"] === undefined && args.flags["face"] === undefined ? {} : faceOption(args); }
  catch (error) {
    if (!(error instanceof FaceOptionMalformed)) throw error;
    emit(args, { ok: false, error: { code: "face-malformed", message: error.message }, human: () => console.error(error.message) });
    return 2;
  }
  const r = named.face === undefined ? await call("list-wikis", {}, await vesselDid())
    : await runVerbAsFace("list-wikis", {}, named.face).catch((err: unknown) => { const f = verbFailure(err); return { status: "error" as const, requestId: f.requestId ?? "", errorMessage: f.message }; });
  if (r.status === "error") {
    const msg = r.errorMessage ?? "unknown";
    if (/^face-not-open:/.test(msg)) {
      emit(args, { ok: false, requestId: r.requestId, error: { code: "face-not-open", message: msg }, human: () => console.error(msg) });
      return exitFor("face-not-open");
    }
    emit(args, { ok: false, requestId: r.requestId, error: msg, human: () => console.error(`list failed: ${msg}`) });
    return 4;
  }
  const result = named.face === undefined ? summaryOutput(r) ?? {} : { ...(summaryOutput(r) ?? {}), face: named.face };
  const wikis = (result["wikis"] ?? []) as Array<{
    slug: string;
    uri: string;
    automergeUrl: string | null;
    kind?: string;
    composition?: string;
    defaultDiffers?: boolean;
    /** `floor`: a system row with no document, its canon read through the floor snapshot (no Kahu reach on this face). */
    canon?: string;
  }>;
  // `--json` answers the daemon's reply verbatim; the prose view adds `composition` (a system wiki's
  // own stack or the default) and whether an own stack differs from the default.
  emit(args, {
    ok: true, requestId: r.requestId, data: result,
    human: () => {
      console.log("");
      if (wikis.length === 0) {
        console.log("(no wikis registered)");
        console.log("");
        return;
      }
      console.log(`wikis (${wikis.length}):`);
      for (const w of wikis) {
        const url = w.automergeUrl ? w.automergeUrl.slice(0, 40) + "…"
          : w.canon === "floor" ? "(canon read through the floor: no live document on this face, which holds no Kahu reach)" : "(no doc)";
        const tag = w.kind ? ` [${w.kind}]` : "";
        const comp = w.composition
          ? `  composition: ${w.composition}${w.defaultDiffers === true ? " (default differs)" : ""}`
          : "";
        console.log(`  ${w.slug.padEnd(20)}${tag} ${w.uri}${comp}`);
        console.log(`    ↳ ${url}`);
      }
      console.log("");
    },
  });
  return 0;
}

/** The hold a mint takes: held within the budget, or a named refusal that evicts nothing. */
async function holdTheMint(slug: string, did: string): Promise<{ held: boolean; note: string }> {
  const active = await call("wiki-active", {}, did);
  const live = (active.status === "error" ? null : summaryOutput(active)) as { held?: unknown; pinBudget?: unknown } | null;
  const holds = Array.isArray(live?.held) ? live.held.map(String) : [];
  const budget = typeof live?.pinBudget === "number" ? live.pinBudget : null;
  if (budget !== null && holds.length >= budget && !holds.includes(slug)) {
    return { held: false, note: `not held: the hold budget stands full (${holds.length}/${budget}: ${holds.join(", ")}); \`lares wiki release <slug>\` frees one, then \`lares wiki hold ${slug}\` holds this wiki` };
  }
  const r = await call("wiki-hold", { slug }, did, { timeoutMs: 30_000 });
  const held = r.status !== "error" && (summaryOutput(r) as { held?: unknown } | null)?.held === true;
  return { held, note: held ? `held (rotatable pin)` : `not held: ${r.errorMessage ?? "the wiki would not activate"}; \`lares wiki hold ${slug}\` retries` };
}

/**
 * WHAT AN INIT OVER A PARTIAL STOOD, in plain words (`status: completed`): the canon row it reused (the floor's, or the face's
 * own), the recipe row it wrote, the bags it registered, the workbench it founded. Null where it stood nothing of these.
 */
export function initCompletedLine(result: Record<string, unknown>): string | null {
  if (result["status"] !== "completed") return null;
  const parts: string[] = [];
  if (result["canonReused"] === "floor") parts.push("canon reused from the floor");
  else if (result["canonReused"] === "own") parts.push("canon reused from this face's catalog");
  if (result["recipeWritten"] === true) parts.push("recipe row written");
  const bags = Array.isArray(result["bagsRegistered"]) ? result["bagsRegistered"].map(String) : [];
  if (bags.length > 0) parts.push(`bags registered: ${bags.join(", ")}`);
  const bench = result["workbench"] as { realmId?: unknown; founded?: unknown } | undefined;
  if (bench?.founded === true && typeof bench.realmId === "string") parts.push(`workbench founded (realm ${bench.realmId.slice(0, 12)}…)`);
  return parts.length > 0 ? parts.join("; ") : null;
}

/** The workbench line an init prints when it stood none for this face: a refusal by name, or a realm this face holds no seat in. */
export function initWorkbenchLine(result: Record<string, unknown>): string | null {
  const bench = result["workbench"] as { realmId?: unknown; refused?: unknown } | undefined;
  if (!bench) return null;
  if (typeof bench.refused === "string") return `none stood: ${bench.refused}`;
  if (bench.realmId === null) return "none stands for this face (another face's realm holds this wiki's workbench and seats this face nowhere, or its document rests sealed under its owner face here); this face writes its personal layer until a share seats it";
  return null;
}

export async function cmdWikiInit(args: ParsedArgs, realmDoors: RealmDoors = LIVE_REALM_DOORS): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki init <slug> [--realm <pet>]");
    return 2;
  }
  // `--realm <pet>` PLACES THE WIKI IN AN EXISTING NAMED REALM BEFORE IT MINTS, so its first mount lays its workbench there; an
  // unnamed realm refuses before anything mints.
  const realm = args.options["realm"];
  if (realm !== undefined) {
    if (typeof realm !== "string" || realm === "") { console.error("usage: lares wiki init <slug> [--realm <pet>]"); return 2; }
    try { await placeWikiInRealm(realmDoors, slug, realm); }
    catch (err) {
      if (!(err instanceof RealmRefused)) throw err;
      emit(args, { ok: false, error: { code: err.code, message: err.message }, human: () => console.error(`init refused: ${err.message}`) });
      return 1;
    }
  }
  const did    = await vesselDid();
  const r = await call("init-wiki", { slug }, did);
  if (r.status === "error") {
    const msg = r.errorMessage ?? "unknown";
    emit(args, { ok: false, requestId: r.requestId, error: msg, human: () => console.error(`init failed: ${msg}`) });
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  // The mint holds the wiki it mints (a cold grain reads `document-unavailable` until held); a wiki that already stood is left as it was.
  const hold = result["status"] === "minted" || result["status"] === "completed" ? await holdTheMint(slug, did) : null;
  // The mint bound (or found) the wiki's workbench realm: the label records its canon realm id beside the pet name. EVERY REALM
  // CARRIES A PET NAME: with no `--realm`, the wiki takes its own realm label under its slug (`realms/<slug>/wikis/<slug>/`).
  let placed: { readonly petName: string } | null = null;
  try { placed = typeof realm === "string" ? await placeWikiInRealm(realmDoors, slug, realm) : (await ensureWikiRealm(realmDoors, slug)).label; }
  catch (err) { if (!(err instanceof RealmRefused)) throw err; }
  emit(args, {
    ok: true, requestId: r.requestId, data: { slug, ...result, ...(hold ? { held: hold.held, holdNote: hold.note } : {}), ...(placed ? { realm: placed.petName } : {}) },
    human: () => {
      console.log("");
      console.log(`wiki: ${slug}`);
      console.log(`  status:    ${result["status"]}`);
      const done = initCompletedLine(result);
      if (done) console.log(`  completed: ${done}`);
      const bench = initWorkbenchLine(result);
      if (bench) console.log(`  workbench: ${bench}`);
      console.log(`  wiki URI:  ${result["wikiUri"]}`);
      console.log(`  canon bag: ${result["canonBag"]}`);
      console.log(`  canon doc: ${result["wikiDocUrl"]}`);
      console.log(`  draft URI: ${result["draftBagId"]}`);
      console.log(`  draft doc: ${result["draftDocUrl"]}`);
      console.log(`  recipe:    ${result["recipeUri"]}`);
      if (hold) console.log(`  hold:      ${hold.note}`);
      if (placed) console.log(`  realm:     ${placed.petName} (its workbench lays under projections/realms/${placed.petName}/wikis/${slug}/)`);
      console.log("");
    },
  });
  return 0;
}

const RETIRE_USAGE = "usage: lares wiki retire <slug> [--face N] [--dry-run] [--force --count <records>]";
/** The refusals `retire-wiki` (and the session door before it) names by code (`<code>: <detail>`); any other failure reads as the transport's. */
const RETIRE_REFUSAL = /^(retire-needs-hand|no-face|system-bag|wiki-face-private|no-such-wiki|not-the-owner|wiki-shared|wiki-not-empty|retire-count-missing|retire-count-moved|retire-carry-unlanded|waking-floor|content-mounted-only|face-not-open|workbench-slug-bound)\b/;

/** The doors `lares wiki retire` reads, injectable for a test: the worn face's ordinal and the one session call. */
export interface RetireDoors {
  wornFace(): Promise<number>;
  call(verb: string, args: Record<string, unknown>, face: number): Promise<SubmitResult>;
}
const LIVE_RETIRE_DOORS: RetireDoors = {
  wornFace: async () => (await sealedAct<{ face: number }>("face.resolve", { worn: true })).face,
  call: (verb, args, face) => runVerbAsFace(verb, args, face),
};

/**
 * `lares wiki retire <slug>` — THE OWNER FACE'S UNMINT: the shell the worn face's `wiki init` laid over a slug (its catalog
 * rows, its workbench's ledger rows, its slot and Keyhive bindings) leaves, so the slug mints again cleanly under the face that
 * should hold it. The canon bag's document and its files stay.
 *
 * A HAND ACT: it rides a session of the worn face (or `--face N`) opened by the `cli` hand, so a seat session refuses at the
 * socket and the island refuses any ask no hand placed. `--dry-run` reads what would leave and the record counts, writing
 * nothing; a shell holding records refuses `wiki-not-empty` unless `--force --count <records>` names that very count.
 *
 * THE RECORD OF LEAVING STAYS: the shell's effect records (the house's residency rows) never leave with it. The vessel carries
 * them, verbatim, into one retirement record per slug in the face's daemon wiki working layer before it erases them, and the
 * answer names where they went; a carry that cannot land refuses `retire-carry-unlanded` with nothing erased.
 *
 * ONCE IT LANDS, the local half: the wiki's hold drops, the workbench mirror folder under its realm steps aside by rename, and
 * the slug's realm label releases the realm id the retired workbench held. Each step reads the state it changes, so a run
 * that died midway finishes on a second run (the vessel then answers `no-such-wiki`, and the local half still runs where the
 * vessel's ledger binds the slug nowhere).
 */
export async function cmdWikiRetire(args: ParsedArgs, realmDoors: RealmDoors = LIVE_REALM_DOORS, doors: RetireDoors = LIVE_RETIRE_DOORS): Promise<number> {
  const slug = args.positional[0];
  if (!slug) { console.error(RETIRE_USAGE); return 2; }
  let named: { face?: number };
  try { named = args.options["face"] === undefined && args.flags["face"] === undefined ? {} : faceOption(args); }
  catch (error) {
    if (!(error instanceof FaceOptionMalformed)) throw error;
    emit(args, { ok: false, error: { code: "face-malformed", message: error.message }, human: () => console.error(error.message) });
    return 2;
  }
  const force = args.flags["force"] === true;
  const dryRun = args.flags["dry-run"] === true;
  const countText = args.options["count"];
  if (countText !== undefined && (!force || !/^\d+$/.test(countText))) { console.error(`${RETIRE_USAGE}\n  --count names the record count a --force retire destroys`); return 2; }
  if (dryRun && force) { console.error(`${RETIRE_USAGE}\n  --dry-run reads and writes nothing; it takes no --force`); return 2; }
  const verbArgs: Record<string, unknown> = { slug, ...(dryRun ? { "dry-run": true } : {}), ...(force ? { force: true } : {}), ...(countText !== undefined ? { count: Number(countText) } : {}) };
  let r: SubmitResult;
  try { r = await doors.call("retire-wiki", verbArgs, named.face ?? await doors.wornFace()); }
  catch (err) { const f = verbFailure(err); r = { status: "error", requestId: f.requestId ?? "", errorMessage: f.message }; }

  // THE LOCAL HALF, idempotent: each step changes only what still stands.
  const localHalf = async (realmRetired: boolean) => {
    const released = await call("wiki-release", { slug }, await vesselDid());
    const folder = setAsideWikiFolder(realmDoors, slug);
    const label = realmRetired ? releaseWikiRealm(realmDoors, slug) : null;
    return { holdReleased: released.status !== "error", folder, label };
  };

  if (r.status === "error") {
    const msg = (r.errorMessage ?? "unknown").replace(/^\[daemon\] /, "");
    const code = RETIRE_REFUSAL.exec(msg)?.[1] ?? (typeof r.refusal?.reason === "string" && RETIRE_REFUSAL.test(r.refusal.reason) ? r.refusal.reason : undefined);
    // A RUN THAT DIED AFTER THE VESSEL'S HALF: the vessel names no shell now. The local half finishes ONLY where this retire chain
    // left it standing: the ledger binds the slug nowhere, and the slug's local label still names THIS face's own realm (the id
    // the refusal carries). A slug this face never held names another realm or none, and its refusal stands: no hold drops.
    const ownRealm = /\(own realm ([0-9a-f]{64})\)/.exec(msg)?.[1];
    if (code === "no-such-wiki" && !dryRun && ownRealm !== undefined && labelRealmOf(realmDoors, slug) === ownRealm) {
      const seat = await realmDoors.seat(slug);
      if (seat.answered && seat.realms.length === 0) {
        const done = await localHalf(true);
        emit(args, { ok: true, requestId: r.requestId, data: { slug, status: "already-retired", ...done.folder ? { folderSetAside: done.folder.to } : {} },
          human: () => console.log(`wiki: ${slug}  status: already-retired (the vessel holds no shell of it; this face's local half finished${done.folder ? `, its folder set aside at ${done.folder.to}` : ""})`) });
        return 0;
      }
    }
    emit(args, { ok: false, requestId: r.requestId, error: code ? { code, message: msg } : msg, human: () => console.error(`retire refused: ${msg}`) });
    return code ? 1 : 4;
  }
  const result = summaryOutput(r) ?? {};
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const records = (result["records"] ?? {}) as { working?: number; draft?: number; personal?: number; effects?: number };
  const counted = `working ${records.working ?? 0}, draft ${records.draft ?? 0}, personal ${records.personal ?? 0}`;
  const effects = records.effects ?? 0;
  const where = (v: unknown): { title?: string; bag?: string; records?: number; added?: number } | null => (v && typeof v === "object" ? v as never : null);
  if (dryRun) {
    emit(args, { ok: true, requestId: r.requestId, data: result, human: () => {
      console.log(`wiki: ${slug}  would retire (nothing written)`);
      console.log(`  catalog rows:  ${list(result["catalogRows"]).join(", ") || "(none)"}`);
      console.log(`  workbench:     ${typeof result["realmId"] === "string" ? `realm ${result["realmId"].slice(0, 12)}…` : "(none stood)"}`);
      console.log(`  authored records: ${String(result["total"] ?? 0)} (${counted})`);
      const to = where(result["carryTo"]);
      console.log(`  effect records:   ${effects}${effects > 0 ? ` (the house's own residency rows; ${to ? `carried to ${to.title} in ${to.bag} before the shell goes` : "no durable home stands for their carry, so the retire would refuse"})` : ""}`);
    } });
    return 0;
  }
  const done = await localHalf(typeof result["realmId"] === "string");
  emit(args, {
    ok: true, requestId: r.requestId,
    data: { ...result, ...(done.label ? { realm: done.label.petName } : {}), holdReleased: done.holdReleased, ...(done.folder ? { folderSetAside: done.folder.to } : {}) },
    human: () => {
      const kept = (result["kept"] ?? {}) as { canonBag?: string; canonDoc?: string | null };
      console.log("");
      console.log(`wiki: ${slug}  status: ${result["status"]}${result["forced"] === true ? " (forced)" : ""}`);
      console.log(`  catalog rows removed:  ${list(result["catalogRows"]).length}${list(result["catalogRows"]).map((t) => `\n    ${t}`).join("")}`);
      console.log(`  ledger rows removed:   ${list(result["ledgerRows"]).length}${typeof result["realmId"] === "string" ? ` (realm ${result["realmId"].slice(0, 12)}…)` : ""}`);
      console.log(`  slot bindings removed: ${list(result["slotBindings"]).length}`);
      console.log(`  keyhive bindings:      ${list(result["keyhiveBindings"]).length}${list(result["keyhiveBindings"]).map((t) => `\n    ${t}`).join("")}`);
      console.log(`  records destroyed:     ${result["forced"] === true ? counted : "none authored"}`);
      const carried = where(result["carried"]);
      if (carried) console.log(`  effect records:        ${carried.records ?? effects} carried to ${carried.title} (${carried.bag}; ${carried.added ?? 0} new), then erased with the shell`);
      const left = list(result["leftBehind"]);
      if (left.length > 0) console.log(`  left behind:           ${left.length} effect record(s) landed after the carry and stay in the shell's documents${left.map((t) => `\n    ${t}`).join("")}`);
      console.log(`  kept:                  ${kept.canonBag ?? `bags/${slug}`} (its document and files untouched)`);
      if (kept.canonDoc) console.log(`  canon doc kept:        ${kept.canonDoc} (a re-mint that finds a floor canon row reuses it; one that finds none mints a fresh one and leaves this one orphaned)`);
      if (done.folder) console.log(`  folder set aside:      ${done.folder.to} (renamed, never deleted)`);
      if (done.label) console.log(`  realm label:           ${done.label.petName} keeps its pet name; its realm id reads unset until the next mint`);
      console.log(`  next: wear the face that should hold it, then \`lares wiki init ${slug}\``);
      console.log("");
    },
  });
  return 0;
}

export async function cmdWikiOpen(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki open <slug>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("open-wiki", { slug }, did);
  if (r.status === "error") {
    console.error(`open failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`wiki: ${slug}  status: ${result["status"]}`);
  if (typeof result["note"] === "string") console.log(`  ${result["note"]}`);
  console.log("");
  return 0;
}

export async function cmdWikiSync(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki sync <slug>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("sync-wiki", { slug }, did, { timeoutMs: 30_000 });
  if (r.status === "error") {
    console.error(`sync failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`sync ${slug}:`);
  console.log(`  scanned:  ${result["scanned"]}`);
  console.log(`  ingested: ${result["ingested"]}`);
  console.log(`  skipped:  ${result["skipped"]}`);
  const errors = (result["errors"] ?? []) as string[];
  if (errors.length > 0) {
    console.log(`  errors (${errors.length}):`);
    for (const e of errors) console.log(`    ${e}`);
  }
  if (result["note"]) console.log(`  ${result["note"]}`);
  console.log("");
  return 0;
}

export async function cmdWikiPin(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki pin <slug>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("pin-wiki", { slug }, did);
  if (r.status === "error") {
    console.error(`pin failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const pinned = (result["pinned"] ?? []) as Array<{ bagUrl: string; reason: string }>;
  console.log("");
  console.log(`wiki ${slug}: pinned ${pinned.length} bag(s)`);
  for (const p of pinned) console.log(`  ${p.bagUrl}  (${p.reason})`);
  if (result["note"]) console.log(`  ${result["note"]}`);
  console.log("");
  return 0;
}

export async function cmdWikiUnpin(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki unpin <slug>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("unpin-wiki", { slug }, did);
  if (r.status === "error") {
    console.error(`unpin failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const unpinned = (result["unpinned"] ?? []) as string[];
  console.log("");
  console.log(`wiki ${slug}: unpinned ${unpinned.length} bag(s)`);
  for (const u of unpinned) console.log(`  ${u}`);
  console.log("");
  return 0;
}

/** `lares wiki switch <slug>` — LIVE-activate a wiki (no reboot; the true swap).
 *  Distinct from `open`, which sets the next-boot pointer. On the browser this also
 *  flips the #projection surface to the newly-live wiki. */
export async function cmdWikiSwitch(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki switch <slug>");
    return 2;
  }
  const did = await vesselDid();
  const r = await call("wiki-switch", { slug, remount: true }, did, { timeoutMs: 30_000 });
  if (r.status === "error") {
    console.error(`switch failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const active = result["active"] === true;
  const held   = (result["held"] ?? []) as string[];
  console.log("");
  if (active) {
    console.log(`switched → ${slug} (live)`);
  } else {
    console.log(`switch ${slug}: NOT activatable (unregistered wiki, or grant exhausted) — parked`);
  }
  if (held.length > 0) console.log(`  held: ${held.join(", ")}`);
  console.log("");
  return active ? 0 : 5;
}

/** `lares wiki hold <slug>` — pin a wiki as a rotatable active pin (budget-enforced:
 *  The daemon bag always + N rotatable; a hold past the budget releases the least-recently-held). */
export async function cmdWikiHold(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki hold <slug>");
    return 2;
  }
  const did = await vesselDid();
  const r = await call("wiki-hold", { slug }, did, { timeoutMs: 30_000 });
  if (r.status === "error") {
    console.error(`hold failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const held   = result["held"] === true;
  const holds  = (result["holds"] ?? []) as string[];
  console.log("");
  console.log(held ? `held → ${slug}` : `hold ${slug}: not activatable — not held`);
  console.log(`  rotatable pins (${holds.length}/${result["budget"] ?? "?"}): ${holds.join(", ") || "(none)"}`);
  console.log("");
  return held ? 0 : 5;
}

/** `lares wiki release <slug>` — drop a wiki's rotatable pin (it stays live, just becomes a cooling candidate). */
export async function cmdWikiRelease(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki release <slug>");
    return 2;
  }
  const did = await vesselDid();
  const r = await call("wiki-release", { slug }, did);
  if (r.status === "error") {
    console.error(`release failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const holds  = (result["holds"] ?? []) as string[];
  console.log("");
  console.log(`released ${slug}`);
  console.log(`  rotatable pins (${holds.length}): ${holds.join(", ") || "(none)"}`);
  console.log("");
  return 0;
}

/** `lares wiki active` — the live switcher state: which wikis run now + which are held. */
export async function cmdWikiActive(_args: ParsedArgs): Promise<number> {
  const did = await vesselDid();
  const r = await call("wiki-active", {}, did);
  if (r.status === "error") {
    console.error(`active failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result  = summaryOutput(r) ?? {};
  const active  = (result["active"] ?? []) as string[];
  const held    = new Set((result["held"] ?? []) as string[]);
  const surface = result["activeSurface"];
  console.log("");
  console.log(`active wikis (${active.length}/${result["activationCap"] ?? "?"}):`);
  if (active.length === 0) console.log("  (none live)");
  for (const w of active) {
    const marks = [held.has(w) ? "📌" : "  ", surface === w ? "◀ surface" : ""].filter(Boolean).join(" ");
    console.log(`  ${marks} ${w}`);
  }
  // THE DAEMON'S STANDING SLOT: the daemon stands no wiki island, so this list never shows it, yet it holds one slot of the cap.
  console.log(`     daemon  (always live; it holds one of the ${result["activationCap"] ?? "?"} slots and stands outside this list)`);
  console.log(`  rotatable pin budget: ${result["pinBudget"] ?? "?"}`);
  console.log("");
  return 0;
}

export async function cmdWikiAddBag(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki add-bag <slug> <bag-uri>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("add-bag", { slug, bagUrl }, did);
  if (r.status === "error") {
    const msg = r.errorMessage ?? "unknown";
    emit(args, { ok: false, requestId: r.requestId, error: msg, human: () => console.error(`add-bag failed: ${msg}`) });
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  emit(args, {
    ok: true, requestId: r.requestId, data: { slug, ...result },
    human: () => {
      console.log("");
      console.log(`wiki ${slug}: ${result["status"]}`);
      console.log(`  bag:    ${result["bagUrl"]}`);
      if (result["stack"]) {
        console.log(`  stack:  ${(result["stack"] as string[]).join(" → ")}`);
      }
      if (result["error"]) console.log(`  error:  ${result["error"]}`);
      console.log("");
    },
  });
  return 0;
}

export async function cmdWikiRemoveBag(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki remove-bag <slug> <bag-uri>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("remove-bag", { slug, bagUrl }, did);
  if (r.status === "error") {
    console.error(`remove-bag failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`wiki ${slug}: ${result["status"]}`);
  console.log(`  bag:    ${result["bagUrl"]}`);
  if (result["stack"]) {
    const stack = result["stack"] as string[];
    console.log(`  stack:  ${stack.length === 0 ? "(empty)" : stack.join(" → ")}`);
  }
  console.log("");
  return 0;
}

/**
 * `lares wiki compact <slug> <bag-url>` — compact one of the wiki's bags.
 *
 * Thin wrapper: verifies the bag is in the wiki's recipe stack, then
 * delegates to bag-compact. Returns the same shape as bag-compact with
 * a recipe-membership check up front.
 */
export async function cmdWikiCompact(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki compact <slug> <bag-url>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("bag-compact", { bagUrl }, did, { timeoutMs: 30_000 });
  if (r.status === "error") {
    console.error(`wiki compact failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`wiki ${slug}: epoch on ${result["bagUrl"]}`);
  console.log(`  old doc:    ${result["oldDocUrl"]}`);
  console.log(`  new doc:    ${result["newDocUrl"]}`);
  console.log(`  tiddlers:   ${result["tiddlerCount"]}  tombstones: ${result["tombstoneCount"]}`);
  console.log(`  layer:      ${result["layerSwapped"] ? "swapped" : "not mounted"}`);
  console.log("");
  return 0;
}

export async function cmdWikiRotateRecipe(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki rotate-recipe <slug>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("rotate-recipe", { slug }, did, { timeoutMs: 30_000 });
  if (r.status === "error") {
    console.error(`rotate-recipe failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`wiki ${slug}: rotated to a fresh canon`);
  console.log(`  new canon doc:   ${result["newCanonDocUrl"]}`);
  console.log(`  previous canon:  ${result["previousCanonUri"]}`);
  console.log(`    ↳ doc:         ${result["previousCanonDocUrl"]}`);
  const stack = (result["stack"] ?? []) as string[];
  console.log(`  recipe stack:    ${stack.length} bag(s)`);
  for (const u of stack) console.log(`    • ${u}`);
  console.log(`  layer:           ${result["layerSwapped"] ? "swapped" : "not mounted"}`);
  if (result["note"]) console.log(`  note:            ${result["note"]}`);
  console.log("");
  return 0;
}

export async function cmdWikiPruneStale(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki prune-stale <slug> [--days <N>]");
    return 2;
  }
  const daysOpt = args.options["days"];
  const did     = await vesselDid();
  const cmdArgs: Record<string, unknown> = { slug };
  if (daysOpt) cmdArgs["daysThreshold"] = Number(daysOpt);
  const r = await call("prune-stale", cmdArgs, did);
  if (r.status === "error") {
    console.error(`prune-stale failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  const stale  = (result["stale"] ?? []) as Array<{ title: string; lastUpdate: string | null; daysIdle: number }>;
  console.log("");
  console.log(`wiki ${slug} prune-stale (threshold: ${result["daysThreshold"]} days):`);
  console.log(`  draft bag: ${result["draftBagId"]}`);
  console.log(`  scanned:   ${result["scanned"]} tiddler(s)`);
  console.log(`  stale:     ${stale.length}`);
  if (stale.length > 0) {
    console.log("");
    for (const s of stale) {
      const idleStr = s.daysIdle < 0 ? "no timestamp" : `${s.daysIdle}d idle`;
      console.log(`    ${s.title}  (${idleStr})`);
    }
    console.log("");
    console.log("  Decide each through a residency ACTION verb (lares act ADD/COPY/MOVE/CLEAR/DROP/LOAD).");
  }
  console.log("");
  return 0;
}

/**
 * `lares wiki resolve <tiddler-uri>` — Residency Model coordinate-inspection.
 *
 * Lists every Manifestation (FRBR Expression-level realization) of `tiddler`
 * across bags in the recipe, ordered highest-priority first. The winning bag
 * (origin-bag for any current read) gets a `→` marker.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model
 *
 * Reuses the `where` verb on the node side (composite.listBagsHolding —
 * live-only). Tombstone-inspection across bags waits on a sibling `resolve`
 * verb that exposes composite.listKapaeBags (named follow-up under
 * the Talk-Story-surfacing principle — operators inspect the audit; the
 * CRDT layer surfaces what it sees).
 */
export async function cmdWikiResolve(args: ParsedArgs): Promise<number> {
  const tiddler = args.positional[0];
  if (!tiddler) {
    console.error("usage: lares wiki resolve <tiddler-uri>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("resolve", { tiddler }, did);
  if (r.status === "error") {
    console.error(`resolve failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result        = summaryOutput(r) ?? {};
  const manifestations = (result["manifestations"] ?? []) as Array<{ bagId: string; changeId?: string }>;
  const tombstones    = (result["tombstones"]    ?? []) as string[];
  const winning       = (result["winningBag"]    ?? null) as string | null;
  const hiddenBy      = (result["hiddenBy"]       ?? null) as string | null;

  console.log("");
  console.log(`Residency for ${tiddler}`);
  if (manifestations.length === 0 && tombstones.length === 0) {
    console.log("  (no residency in any bag — tiddler unknown)");
    console.log("");
    return 5;
  }
  console.log("");

  if (manifestations.length > 0) {
    console.log("  Live Manifestations (highest priority first):");
    for (const m of manifestations) {
      const marker  = m.bagId === winning ? "→" : " ";
      const idTag   = m.changeId ? `  [change-id: ${m.changeId}]` : "";
      console.log(`    ${marker} ${m.bagId}${idTag}`);
    }
    console.log("");
    if (winning) console.log(`  Winning surface (origin-bag): ${winning}`);
    console.log("");
  } else {
    console.log("  (no live Manifestations — the title carries only kāpae marks)");
    console.log("");
  }

  if (hiddenBy) console.log(`  Hidden by: ${hiddenBy}`);

  if (tombstones.length > 0) {
    console.log("  Kāpae marks (bags that have set this title aside at their priority):");
    for (const b of tombstones) {
      console.log(`      ${b}`);
    }
    console.log("");
    console.log("  Note: a kāpae mark in a higher-priority bag stops the cascade.");
    console.log("        See bags/lararium/ha.ka.ba/lararium/api/residency-model.md #conflict-resolution");
    console.log("        — resolution surfaces to operator / cabal Talk Story.");
    console.log("");
  }

  return manifestations.length > 0 ? 0 : 5;
}

export async function cmdWikiWhich(args: ParsedArgs): Promise<number> {
  const tiddler = args.positional[0];
  if (!tiddler) {
    console.error("usage: lares wiki which <tiddler-uri>");
    return 2;
  }
  const did    = await vesselDid();
  const r = await call("where", { tiddler }, did);
  if (r.status === "error") {
    console.error(`which failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result  = summaryOutput(r) ?? {};
  const bags    = (result["bags"]       ?? []) as string[];
  const primary = (result["primaryBag"] ?? null) as string | null;
  console.log("");
  console.log(`tiddler:    ${tiddler}`);
  console.log(`primary:    ${primary ?? "(not found)"}`);
  if (bags.length > 0) {
    console.log(`all bags:`);
    for (const b of bags) console.log(`  ${b}`);
  }
  console.log("");
  return primary ? 0 : 5;
}

// ── THE TIDDLER DOOR's engine verbs: filter · render · status ─────────────────────────────────────────

/** `lares wiki filter '<filter>'`: the daemon verb `wiki-filter` and the args it receives. */
export function wikiFilterPlan(args: ParsedArgs): DoorPlan {
  const filter = args.positional[0];
  if (!filter) throw new DoorUsage("a filter is required (e.g. `lares wiki filter '[tag[memory]sort[title]]' --recipe default`)");
  const out: Record<string, unknown> = { ...engineContainerArgs(args, "wiki filter"), filter, ...targetOf(args) };
  const fields = namesOf(args.options["fields"]);
  if (fields) out["fields"] = fields;
  const limit = countOf(args.options["limit"], "limit");
  if (limit !== null) out["limit"] = limit;
  const maxBytes = countOf(args.options["max-bytes"], "max-bytes");
  if (maxBytes !== null) out["maxBytes"] = maxBytes;
  const after = wordOf(args.options["after"]);
  if (after) out["after"] = after;
  return { verb: "wiki-filter", args: out };
}

/** `lares wiki render <title>` or `lares wiki render --text '<span>'`: the daemon verb `wiki-render` and its args. */
export function wikiRenderPlan(args: ParsedArgs): DoorPlan {
  const title = args.positional[0];
  const span = typeof args.options["text"] === "string" ? args.options["text"] : "";
  if (Boolean(title) === Boolean(span)) throw new DoorUsage("name one source: a title (`lares wiki render \"My Note\" --recipe default`) or a span (`--text \"''bold'' {{My Note}}\"`)");
  const out: Record<string, unknown> = { ...engineContainerArgs(args, "wiki render"), ...(title ? { title } : { text: span }), ...targetOf(args) };
  const form = wordOf(args.options["form"]);
  if (form) {
    if (form !== "text" && form !== "html") throw new DoorUsage(`--form reads text or html (got "${form}")`);
    out["form"] = form;
  }
  const type = wordOf(args.options["type"]);
  if (type) out["type"] = type;
  const maxBytes = countOf(args.options["max-bytes"], "max-bytes");
  if (maxBytes !== null) out["maxBytes"] = maxBytes;
  const after = wordOf(args.options["after"]);
  if (after) out["after"] = after;
  return { verb: "wiki-render", args: out };
}

/** `lares wiki status`: the daemon verb `wiki-status` and its args. */
function wikiStatusPlan(args: ParsedArgs): DoorPlan {
  return { verb: "wiki-status", args: { ...engineContainerArgs(args, "wiki status"), ...targetOf(args) } };
}

export function wikiActionPlan(args: ParsedArgs): DoorPlan {
  const name = args.positional[0];
  if (!name || args.positional.length !== 1) throw new DoorUsage("name one admitted action: wiki act sidebar-layout --recipe <wiki> --expected <layout> --resulting <layout>");
  const expected = wordOf(args.options["expected"]);
  const resulting = wordOf(args.options["resulting"]);
  if (!expected || !resulting) throw new DoorUsage("--expected and --resulting each need a layout value");
  return { verb: "wiki-action", args: { ...engineContainerArgs(args, "wiki act"), name, expected, resulting } };
}

async function cmdWikiAction(args: ParsedArgs): Promise<number> {
  return guardDoor(args, "wiki act", async () => {
    const ran = await runDoor(args, "wiki act", wikiActionPlan(args));
    if (!ran.ok) return ran.exit;
    emit(args, { ok: true, requestId: ran.requestId, data: ran.output,
      human: () => { console.log(String(ran.output["has"])); console.log(`${String(ran.output["decision"])} ${String(ran.output["title"])} · receipt ${ran.requestId}`); } });
    return 0;
  });
}

interface FilterRowOut { title: string; fields: Record<string, string>; omitted?: string[] }

/**
 * A FILTER'S ANSWER ARRIVES IN PAGES. One call prints one page and names the cursor of the next on stderr (`--after`
 * continues it); `--all` follows the cursor to the end and prints every title. A cursor that fails to advance refuses
 * by name, and a wiki that moved mid-walk answers the verb's own `filter-cursor-stale`.
 */
async function cmdWikiFilter(args: ParsedArgs): Promise<number> {
  return guardDoor(args, "wiki filter", async () => {
    const plan = wikiFilterPlan(args);
    const titles: string[] = [];
    const rows: FilterRowOut[] = [];
    let last: Record<string, unknown> = {};
    let requestId = "";
    let pages = 0;
    for (let after: string | null = null; ;) {
      const ran = await runDoor(args, "wiki filter", after === null ? plan : { verb: plan.verb, args: { ...plan.args, after } });
      if (!ran.ok) return ran.exit;
      requestId = ran.requestId;
      last = ran.output;
      pages++;
      if (Array.isArray(last["rows"])) rows.push(...(last["rows"] as FilterRowOut[]));
      else if (Array.isArray(last["titles"])) titles.push(...(last["titles"] as string[]));
      const next = last["next"];
      if (args.flags["all"] !== true || typeof next !== "string" || next === "") break;
      if (next === after) {
        const message = `the filter's cursor stood still at ${next}`;
        emit(args, { ok: false, requestId, error: { code: "verb-error", message }, human: () => console.error(`lares wiki filter: ${message}`) });
        return 4;
      }
      after = next;
    }
    // One page rides as the verb answered it; `--all` rides the pages joined, `next` null and the page count beside them.
    const data = pages === 1 ? last : { ...last, ...(rows.length > 0 || Array.isArray(last["rows"]) ? { rows } : { titles }), next: last["next"] ?? null, pages };
    emit(args, {
      ok: true, requestId, data,
      human: () => {
        // One title per line; named fields follow their title, tab-joined, so a shell cuts them.
        for (const title of titles) console.log(title);
        for (const row of rows) console.log([row.title, ...Object.entries(row.fields).map(([name, value]) => `${name}=${value}`)].join("\t"));
        const shown = titles.length + rows.length;
        if (typeof last["next"] === "string" && last["next"] !== "") console.error(`${shown} of ${last["total"]} · next: --after ${last["next"]}`);
        else console.error(`${shown} of ${last["total"]}`);
        if (typeof last["withheld"] === "number") console.error(`${last["withheld"]} withheld (titles that stay home, or records this face holds no read on)`);
      },
    });
    return 0;
  });
}

async function cmdWikiRender(args: ParsedArgs): Promise<number> {
  return guardDoor(args, "wiki render", async () => {
    const ran = await runDoor(args, "wiki render", wikiRenderPlan(args));
    if (!ran.ok) return ran.exit;
    const out = ran.output;
    emit(args, {
      ok: true, requestId: ran.requestId, data: out,
      // The render alone reaches stdout, so a pipe carries it; the reading rides stderr.
      human: () => {
        stdout.write(String(out["text"] ?? ""));
        if (out["truncated"] === true) console.error(`\ntruncated at the byte cap (${out["bytes"]} bytes whole) · next: --after ${out["next"]}`);
      },
    });
    return 0;
  });
}

async function cmdWikiStatus(args: ParsedArgs): Promise<number> {
  return guardDoor(args, "wiki status", async () => {
    const ran = await runDoor(args, "wiki status", wikiStatusPlan(args));
    if (!ran.ok) return ran.exit;
    const out = ran.output;
    let consented: readonly string[] = [];
    try { consented = tempConsentedSlugs(loadLaresConfig()); } catch { consented = []; }
    emit(args, {
      ok: true, requestId: ran.requestId, data: out,
      human: () => { for (const line of wikiStatusLines(out, consented)) console.log(line); },
    });
    return 0;
  });
}

/** The temp slot a layer names (`lar:///ha.ka.ba/wikis/<slug>/temp`): its wiki's slug, or null for any other layer. */
function tempSlugOf(bag: string): string | null {
  const slug = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/temp$/.exec(bag)?.[1];
  return slug !== undefined && wikiSlotKindOf(slug, bag) === "temp" ? slug : null;
}

/**
 * THE LINES `lares wiki status` PRINTS: each layer's reach for this face. A wiki's temp layer stands opt-in (device-local
 * scratch, projected only where `projection.temp.<slug>` consents): unconsented it reads `temp (opt-in, off)` and names no
 * fault, consented it reads `temp (opt-in, on)` beside its reach.
 */
export function wikiStatusLines(out: Record<string, unknown>, consented: readonly string[]): string[] {
  const layers = Array.isArray(out["layers"]) ? (out["layers"] as Array<{ bag: string; mounted: string; read: boolean; write: boolean; working?: boolean; why?: string }>) : [];
  const lines = [`wiki: ${String(out["recipe"])}  working layer: ${typeof out["working"] === "string" ? out["working"] : "(none attached; no layer takes a write)"}`];
  for (const layer of layers) {
    const reach = layer.write ? "read + write" : layer.read ? "read-only" : "no reach";
    const tempSlug = tempSlugOf(layer.bag);
    if (tempSlug !== null && !consented.includes(tempSlug) && !layer.working) { lines.push(`  ${"temp (opt-in, off)".padEnd(12)} ${layer.bag}`); continue; }
    const label = tempSlug !== null ? `temp (opt-in, on) ${reach}` : reach;
    lines.push(`  ${label.padEnd(12)} ${layer.bag}${layer.working ? "  <- a write lands here" : ""}${layer.why ? `  (${layer.why})` : ""}`);
  }
  return lines;
}

const SUBCOMMANDS: Readonly<Record<string, { handler: WikiSubcommand; summary: string }>> = {
  "init":  { handler: (a) => cmdWikiInit(a),  summary: "Mint a fresh wiki: wiki canonical + per-wiki draft + recipe. Idempotent: over a shell a partial init left it stands what is missing (the recipe row, this face's bag registrations, its workbench) and answers `completed` naming each; run again, it answers `already-exists` and changes nothing. Its workbench lays at projections/realms/<slug>/wikis/<slug>/ (the realm's default pet name, the slug); `--realm <pet>` places it in an existing realm instead (`lares realm list`)." },
  "retire": { handler: (a) => cmdWikiRetire(a), summary: "Unmint a wiki shell the worn face minted (`lares wiki retire <slug> [--face N] [--dry-run] [--force --count <records>]`), a person's hand alone (a seat session refuses): its catalog rows, its workbench's ledger rows and its slot and Keyhive bindings leave, its workbench folder steps aside by rename, the slug's realm label forgets the realm id, and the slug mints again under another face. The canon bag and its files stay. A face that does not own the shell refuses `not-the-owner`; a shared shell refuses `wiki-shared` (remove the shares first); `--dry-run` reads the record counts, the authored records apart from the house's effect records (a gated ingest's residency rows, which the retire carries, verbatim, into one retirement record per slug in the face's daemon wiki working layer before the shell goes, refusing `retire-carry-unlanded` with nothing erased where that carry cannot land); a shell holding authored records refuses `wiki-not-empty` unless `--force --count` names that count." },
  "share": { handler: cmdShare("wiki"), summary: "Share a wiki with sibling faces through a private cabal: its canon by reference and its working layer as ONE shared workbench every member face syncs (--read <names> --write <names> --note <why> --face N --workspace <name>). A line names its delta: --read and --write add names beside the standing ones, --read-remove and --write-remove take names out, and what it leaves unnamed stands, so the same line twice changes nothing. --read and --write add and never replace a list: narrowing one takes the -remove pair, which revokes each taken-out face's landed grant (a face standing shut keeps the row as it stood, named); --list shows the resolved answer; --remove unshares it. A bag row standing for the slug refuses (share-kind-standing). The daemon wiki never shares." },
  "open":  { handler: cmdWikiOpen,  summary: "Set which wiki the next `lares vessel stand --foreground` boot mounts as active. Does not live-remount the current vessel." },
  "switch": { handler: cmdWikiSwitch, summary: "LIVE-activate a wiki (no reboot — the true swap; wakes it cold from its recipe). Browser flips the projection surface." },
  "hold":    { handler: cmdWikiHold,    summary: "Pin a wiki as a rotatable active pin (the daemon bag always + N rotatable; a hold past budget releases the least-recently-held)." },
  "release": { handler: cmdWikiRelease, summary: "Drop a wiki's rotatable pin (it stays live, becomes a cooling candidate)." },
  "active":  { handler: cmdWikiActive,  summary: "Show the live switcher state: which wikis run now + which are held + the projection surface (the daemon always holds one slot and stands outside the list)." },
  "sync":  { handler: cmdWikiSync,  summary: "Walk wikis/<slug>/memes/** and ingest into the canonical bag. Idempotent." },
  "pin":        { handler: cmdWikiPin,       summary: "Pin every bag in the wiki's recipe (whole-recipe STOWAGE — the heat axis, never the canon one `resolve` reads)." },
  "unpin":      { handler: cmdWikiUnpin,     summary: "Unpin every bag in the wiki's recipe." },
  "add-bag":    { handler: cmdWikiAddBag,    summary: "Add a bag to the wiki's recipe at runtime. Hot-reload via composite.addLayer." },
  "remove-bag": { handler: cmdWikiRemoveBag, summary: "Remove a bag from the wiki's recipe (soft remove; F-arc adds StoryList drain)." },
  "compact":       { handler: cmdWikiCompact,         summary: "DXOS-style snapshot-restart on one of the wiki's bags. Bounds history." },
  "rotate-recipe": { handler: cmdWikiRotateRecipe,  summary: "Nix-generations: mint fresh canonical; retain old as previous-canon underlay." },
  "prune-stale":   { handler: cmdWikiPruneStale,    summary: "Surface stale draft tiddlers (no recent activity) for residency-action-or-prune." },
  "list":       { handler: cmdWikiList,      summary: "Enumerate wikis registered in the catalog. Needs `lares vessel stand --foreground`." },
  "which":      { handler: cmdWikiWhich,     summary: "Recipe-presence query — list bags holding a tiddler. Needs `lares vessel stand --foreground`." },
  "resolve":    { handler: cmdWikiResolve,   summary: "Residency Model coordinate-inspection — list all Manifestations of a tiddler across bags; highlight winning bag per recipe priority. Needs `lares vessel stand --foreground`." },
  "filter":     { handler: cmdWikiFilter,    summary: "Run a TiddlyWiki filter in the wiki's own engine (`--recipe default` the daemon wiki, `--recipe <slug>` any wiki this face reaches): `lares wiki filter '[tag[memory]sort[title]]' --recipe default [--fields a,b] [--limit N] [--max-bytes N] [--after <cursor>] [--all]`. One bounded page per call, the next cursor on stderr; a malformed filter refuses `filter-malformed`. The link graph rides filters: `[[T]backlinks[]]`, `links[]`, `transcludes[]`, `backtranscludes[]`. `--target <h1|pet name>` reads another lit face's daemon wiki (its canon and working layer, never its personal layer) while keeping the face worn." },
  "render":     { handler: cmdWikiRender,    summary: "Wikify a title or a span through the wiki's own engine (the daemon wiki or any wiki this face reaches): `lares wiki render <title> --recipe default [--form text|html] [--max-bytes N] [--after <cursor>]`, or `--text '<wikitext>' [--type <mime>]`. The render reaches stdout. `--target <h1|pet name>` renders in another lit face's view (never its personal layer), keeping the face worn." },
  "status":     { handler: cmdWikiStatus,    summary: "Name each layer the wiki composes and whether this face reads and writes it: `lares wiki status --recipe default` (or `--recipe <slug>`, any wiki this face reaches). The working layer takes every write (this face's personal layer of a wiki where it holds no writer's seat). A wiki's temp layer reads `temp (opt-in, off)` until `projection.temp.<slug>` consents to it. `--target <h1|pet name>` names another lit face's view, whose layers read `write: false`." },
  "act":        { handler: cmdWikiAction, summary: "Run one admitted native action: `wiki act sidebar-layout --recipe <wiki> --expected fixed-fluid --resulting fluid-fixed`." },
};

/** The wiki door's help, drawn from the sub-verb table: `lares wiki help` and `lares wiki --help` print these lines. */
export function wikiHelpLines(): string[] {
  const width = Math.max(...Object.keys(SUBCOMMANDS).map((v) => v.length));
  return ["lares wiki <verb> [args...]", "", "Verbs:", ...Object.entries(SUBCOMMANDS).map(([verb, entry]) => `  ${verb.padEnd(width)} ${entry.summary}`)];
}

function printWikiHelp(): void {
  for (const line of wikiHelpLines()) console.log(line);
}

export async function cmdWiki(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || args.flags["help"]) {
    printWikiHelp();
    return verb ? 0 : 2;
  }
  const entry = SUBCOMMANDS[verb];
  if (!entry) {
    console.error(`lares wiki: unknown verb "${verb}". Run \`lares wiki help\` for the list.`);
    return 2;
  }
  const inner: ParsedArgs = {
    command:    "wiki",
    positional: args.positional.slice(1),
    options:    args.options,
    flags:      args.flags,
  };
  return await entry.handler(inner);
}
