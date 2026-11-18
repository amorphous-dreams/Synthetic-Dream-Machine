/**
 * vault-restore — the command's half of ONE FACE'S RESTORE: read the bundle file, open its slot tree under a route
 * a person presents, and hand the sealed body and the bundle key to the vessel's custody door.
 *
 * The route arrives as a value: `lares vault restore` reads it on a terminal (`custody-prompt`), and the test door
 * for marked scratch roots hands in the published test route. This module reads no terminal, no flag and no
 * environment variable.
 *
 * WHAT CROSSES THE DOOR. One act of the sealed-act table: `bundle.restore` (the lineage: a recovery act that takes
 * a NEW seat) or, under `--memory`, `bundle.import` (the content keys, onto the restored seat). The act carries the
 * body still SEALED and the bundle key; the vessel opens the body behind its own door, so the face's root reaches
 * no receipt, outcome, argument digest or log line. With no vessel standing the same act runs in this process.
 *
 * THE ROOT CARDS (`--cards`). The card reader rebuilds the root and builds the face's body in this process; the body
 * crosses sealed under a fresh bundle key, through the same `bundle.restore` act, so the cards' seed never rides an
 * argument in the clear and the restore runs every check a bundle's body passes.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { readFileSync } from "node:fs";
import { canonicalJsonBytes, hex, mintBundleKey, openBundleKey, readFaceBundle, sealFaceBundleBody, type Credential } from "@lararium/mesh";
import { nativeKdf } from "@lararium/mesh/node";
import { CardRestoreRefused, buildCardBody, type FaceNamed, type PresentedCard } from "@lararium/node";
import { SEALED_BYTES_LINE } from "./vault-backup.js";

/** A restore or an import that refused, under the name the command or the vessel gave it. */
export interface RestoreRefusal { readonly ok: false; readonly reason: string; readonly message: string }

/** What a restore that landed answers (the act's own answer; nothing secret). */
export interface RestoreLanded {
  readonly ok: true;
  readonly kind: "restore";
  readonly via: "vessel" | "direct";
  readonly face: { readonly handleIndex: number; readonly verifyingKey: string };
  readonly prefix: string;
  readonly resumed: boolean;
  readonly checked: { readonly seq: number; readonly from: "board" | "bundle" };
  readonly recoveryContactSet: "none" | "landed" | "held" | "absent";
  readonly provisional: { readonly couldConfirm: readonly string[] };
  readonly landed: { readonly faceProofKeys: number; readonly petname: boolean; readonly handle: boolean; readonly handleBook: { readonly landed: number; readonly kept: number } };
  readonly holds: ReadonlyArray<{ readonly bagId: string; readonly founding: string; readonly keyVersion: string }>;
}
/** What an import that ran answers: one outcome per version the bundle's memory section carries. */
export interface ImportLanded {
  readonly ok: true;
  readonly kind: "import";
  readonly face: { readonly handleIndex: number; readonly verifyingKey: string };
  readonly results: ReadonlyArray<{ readonly bagId: string; readonly keyVersion: string; readonly outcome: string; readonly cause?: string }>;
}

/** One act of the sealed-act table, as `sealed-act-door` runs it: the act's answer and where it ran. */
export type RunAct = (act: "bundle.restore" | "bundle.import", args: Readonly<Record<string, unknown>>) => Promise<{ readonly result: Record<string, unknown>; readonly via: "vessel" | "direct" }>;

/**
 * Open the bundle at `file` under `credentials` and run its restore, or its memory import. Refuses by name: a
 * file that reads as no bundle (`bundle-malformed`), a route that opens no slot (`no-slot-opens`), and whatever
 * the vessel's own act refuses.
 */
export async function restoreFromBundle(args: {
  readonly file:        string;
  readonly credentials: readonly Credential[];
  readonly as?:         number;
  readonly memory:      boolean;
  readonly run:         RunAct;
}): Promise<RestoreLanded | ImportLanded | RestoreRefusal> {
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(readFileSync(args.file)); }
  catch (err) { return { ok: false, reason: "bundle-unreadable", message: `no bundle reads at ${args.file} (${(err as NodeJS.ErrnoException).code ?? "unreadable"})` }; }
  const read = readFaceBundle(bytes);
  if (read.reading !== "readable") return { ok: false, reason: "bundle-malformed", message: `${args.file} reads as no backup bundle: ${read.why}. Nothing moved.` };
  const opened = await openBundleKey(read.tree, args.credentials, nativeKdf);
  if (opened.reading !== "opens") {
    return { ok: false, reason: "no-slot-opens", message: `no route of the bundle opens under what was presented${opened.notes.length ? ` (${opened.notes.join("; ")})` : ""}. Nothing moved.` };
  }
  try {
    const body = Buffer.from(read.sealedBody).toString("base64");
    const key = hex(opened.bundleKey);
    const { result, via } = await args.run(args.memory ? "bundle.import" : "bundle.restore", args.memory ? { body, key } : { body, key, ...(args.as !== undefined ? { as: args.as } : {}) });
    if (typeof result["refused"] === "string") {
      return { ok: false, reason: result["refused"], message: typeof result["message"] === "string" ? result["message"] : "the vessel refused" };
    }
    if (args.memory) return { ok: true, kind: "import", face: result["face"] as ImportLanded["face"], results: (result["results"] ?? []) as ImportLanded["results"] };
    return landedOf(result, via);
  } finally { opened.bundleKey.fill(0); }
}

/** A restore's answer, as the act gave it. */
function landedOf(result: Record<string, unknown>, via: "vessel" | "direct"): RestoreLanded {
  return {
    ok: true, kind: "restore", via, face: result["face"] as RestoreLanded["face"], prefix: String(result["prefix"]), resumed: result["resumed"] === true,
    checked: result["checked"] as RestoreLanded["checked"], recoveryContactSet: (result["recoveryContactSet"] ?? "none") as RestoreLanded["recoveryContactSet"],
    provisional: (result["provisional"] ?? { couldConfirm: [] }) as RestoreLanded["provisional"], landed: result["landed"] as RestoreLanded["landed"], holds: (result["holds"] ?? []) as RestoreLanded["holds"],
  };
}

/**
 * Rebuild a face's root from its split cards and run its restore at `as`. Refuses by name: the card reader's own
 * refusals (too few cards, one custodian, a malformed or repeated card, no face named, another root), then
 * whatever the vessel's own act refuses. The face lands with no names, proof keys, handle-book or memory: paper
 * restores a root, never memory.
 */
export async function restoreFromCards(args: {
  readonly cards: readonly PresentedCard[];
  readonly face:  FaceNamed;
  readonly as:    number;
  readonly run:   RunAct;
}): Promise<RestoreLanded | RestoreRefusal> {
  let plain: Uint8Array;
  try { plain = canonicalJsonBytes(await buildCardBody({ cards: args.cards, face: args.face, as: args.as })); }
  catch (err) { if (err instanceof CardRestoreRefused) return { ok: false, reason: err.reason, message: err.message }; throw err; }
  const bundleKey = mintBundleKey();
  try {
    const body = Buffer.from(sealFaceBundleBody(plain, bundleKey)).toString("base64");
    const { result, via } = await args.run("bundle.restore", { body, key: hex(bundleKey), as: args.as });
    if (typeof result["refused"] === "string") {
      return { ok: false, reason: result["refused"], message: typeof result["message"] === "string" ? result["message"] : "the vessel refused" };
    }
    return landedOf(result, via);
  } finally { plain.fill(0); bundleKey.fill(0); }
}

/** The lines a landed restore prints: the face, its NEW seat, the head the check read, and what the import still owes. */
export function restoreLines(landed: RestoreLanded): string[] {
  const lines = [
    `${landed.resumed ? "restored (a restore that stood pending completed)" : "restored"}: the face ${landed.face.verifyingKey.slice(0, 16)}… stands at h${landed.face.handleIndex} under its own fixed prefix ${landed.prefix.slice(0, 16)}….`,
    "  a recovery act, never a row copy: this vessel derived its OWN veil and took a NEW seat. No seat of the lost vessel stands again.",
    `  landed: the root and its roster line, ${landed.landed.faceProofKeys} face proof key(s), ${landed.landed.handleBook.landed} handle-book record(s) (${landed.landed.handleBook.kept} already held)` +
      `${landed.landed.petname ? ", its pet-name" : ""}${landed.landed.handle ? ", its declared Handle" : ""}. A name this vessel already held stays.`,
    landed.checked.from === "board"
      ? `  key history: this vessel's own board held the face's history, and its newest head (sequence ${landed.checked.seq}) still accepts this root.`
      : `  key history: this vessel's board held no history for the face, so the check read the bundle's own log, as far as its cut (sequence ${landed.checked.seq}). A rotation that landed after the cut shows only on a board: every reader that holds the newer head refuses this seat at its own gate.`,
    ...recoveryContactLines(landed.recoveryContactSet),
    "  PROVISIONAL: the face reads, recovers and serves its own content, and signs no act that changes who holds authority until a party to its relation shows its own view of the head above and that view agrees (`lares persona confirm`). Who could confirm:",
    ...landed.provisional.couldConfirm.map((line) => `    ${line}`),
    landed.via === "vessel"
      ? "  the face mounts when the vessel stands again: `lares vessel stand --restart`, then `lares vault unlock`."
      : "  the face mounts when the vessel stands: `lares vessel stand`, then `lares vault unlock`.",
  ];
  if (landed.holds.length > 0) {
    lines.push(`  memory: the bundle carries ${landed.holds.length} key version(s). With the vessel standing unlocked and wearing this face, run:  lares vault restore <file> --memory`);
  } else {
    lines.push("  memory: the bundle carries no content key.");
  }
  lines.push(`  ${SEALED_BYTES_LINE}`);
  return lines;
}

/** What a restore says of the face's recovery contact set, where its key history commits one. */
function recoveryContactLines(set: RestoreLanded["recoveryContactSet"]): string[] {
  if (set === "landed") return ["  recovery contacts: the bundle carried the set the face's key history commits, and this vessel holds its sealed row."];
  if (set === "held") return ["  recovery contacts: this vessel already held the set the face's key history commits; it stays as it stood."];
  if (set === "absent") {
    return ["  recovery contacts: the face's key history commits a recovery contact set this bundle did not carry (it was cut before the enrolment). The recovery contacts still hold their own keys; cut a fresh bundle from a vessel that holds the set to carry it."];
  }
  return [];
}

/** The lines an import prints: each version's outcome, and the half the bundle never held. */
export function importLines(landed: ImportLanded): string[] {
  const lines = [`imported onto the seat of the face at h${landed.face.handleIndex} (${landed.face.verifyingKey.slice(0, 16)}…):`];
  if (landed.results.length === 0) lines.push("  the bundle's memory section holds no content key.");
  for (const r of landed.results) lines.push(`  ${r.outcome.padEnd(22)} ${r.bagId}  version ${r.keyVersion.slice(0, 16)}…${r.cause ? `  (${r.cause})` : ""}`);
  lines.push("  each key opens only where the sealed BYTES stand in this vessel's rests.");
  lines.push(`  ${SEALED_BYTES_LINE}`);
  return lines;
}
