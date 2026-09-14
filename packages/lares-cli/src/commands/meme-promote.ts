/**
 * meme-promote — THE PRIESTHOOD ACT, PERFORMED AS A RESIDENCY MOVE AND RECORDED.
 *
 * `lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary` names the blocker plainly: a
 * promotion into a canon bag is PERMITTED by capability and RECORDED by nothing. `mintPromotionReceipt`
 * (`@lararium/mesh`) built the record. This module performs the crossing the record describes, and refuses
 * to perform one it could not record.
 *
 * ── A PROMOTION MOVES RESIDENCY, AND THAT IS THE WHOLE ACT ──────────────────────────────────────
 * A residency move changes the envelope's bag and NOTHING ELSE — no path rename, no host assignment, no
 * re-stamp. ADDRESS STABILITY rules why: //the thing an address names does not become a different thing.
 * This is what makes an edge worth writing//. So the crossing renames no address, welds no edge, and
 * re-stamps no block check.
 *
 * ⚠ AND THE CROSSING ASSIGNS NO HOST (operator ruling). A `lar:` URI naming an authority
 * (`lar://alias:grant@host/…`) says WHO SPOKE, UNDER WHAT GRANT, FROM WHERE — a property of the CONTENT,
 * never of the layer it sits on. Any `lar:` URI serves as a valid meme title, so a captured exchange split
 * by speaker-aim URI stands as a legitimate canon meme carrying a hostful address forever; current canon
 * memes read hostless because that is how they were authored. A door that assigned a hostless address here
 * would fabricate one the carrier never carried.
 *
 * Residency rides the ENVELOPE, never a path and never a persisted field: `store.put(record, origin, { bag })`
 * takes the bag beside the record, and `UNPERSISTED_FIELDS = ["bag", "$origin-bag"]` keeps it off every
 * persisted byte. A residency move therefore touches no byte of the carrier — so the carrier's bytes, its
 * declared `uri-path`, its `file-path`, its own address mark and its block check all stand identical across
 * a promotion, and every carrier that points at it keeps pointing at the same live name.
 *
 * ── THE CROSSING, IN ORDER ──────────────────────────────────────────────────────────────────────
 *   · READ the subject and its declared address. The address names the record's TITLE — one carrier-group,
 *     root plus every `#fragment` and `/path` child, which is what the residency MOVE carries.
 *   · ASK RESIDENCY, never a path. Which bags hold the record? One already holding the canon bag names a
 *     crossing that completed; none holding any bag names one that never had a live layer to leave.
 *   · REFUSE an ungoverned carrier, and one standing off `lifecycle/standing`. The boundary crosses a thing
 *     with a LIFECYCLE, and only from the state that has settled: a lean, a fold, a draft names a state the
 *     crossing has no meaning from.
 *   · MINT THE RECEIPT FIRST, cap reading and all. The refusals run BEFORE anything moves, so a refused
 *     promotion leaves a tree byte-identical to the one it found — including the cap refusal, which is the
 *     one a hand is most likely to meet.
 *   · ASK FOR THE RESIDENCY MOVE. `executeMove` already performs exactly this act: whole-carrier-group
 *     transfer, land-then-retract ordering, `change-id` preserved, a hard RETRACT at the source, and the
 *     title unchanged throughout. Its own comment names this use case — //promotion working → canon reveals
 *     the canon copy//. This door builds no second mover.
 *   · WRITE the receipt BESIDE the carrier (`promotionReceiptPath` — the mesh module already rules where it
 *     rests: sharing the carrier's name, so a reader holding the carrier holds the record of how it arrived,
 *     with no index to consult and none to fall out of step). The carrier's path never moved, so neither did
 *     the place the receipt rests.
 *
 * ── THE SEAT ARRIVES INJECTED ───────────────────────────────────────────────────────────────────
 * The receipt module "holds no key and reads no cap"; this door keeps the same discipline one layer out. The
 * proposer, the approver, its key, its signer, the ADMIN READING, the RESIDENCY READING and the MOVE all
 * arrive as arguments, so the whole crossing runs in a witness with no vessel, no keyring and no daemon —
 * and every refusal is testable without one.
 *
 * AND THE READINGS BELONG TO THE DAEMON. Residency and capability both answer from the CRDT the daemon holds
 * the canonical replica of; a CLI that answered either locally would be reading a projection and calling it
 * the record. The terminal door (`meme.ts`) reaches the daemon over the verb plane for both — asking IS the
 * cure — and this module never learns which transport carried the answer.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary
 */

import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { mintPromotionReceipt, promotionReceiptPath } from "@lararium/mesh";
import { bccOf } from "@lararium/tw5";

/** The residency MOVE this door asks for — `executeMove`'s own shape. The title never changes. */
export interface PromotionMove {
  readonly title:   string;
  readonly fromBag: string;
  readonly toBag:   string;
}

/** The hand that approves the crossing, and the readings it brings. Nothing here is discovered. */
export interface PromotionSeat {
  readonly proposerNym:    string;
  readonly approverNym:    string;
  readonly approverKeyDid: string;
  /** The cap reading, injected — this module opens no keyring and resolves no delegation. */
  holdsAdmin(nym: string, bag: string): Promise<boolean>;
  /** THE RESIDENCY READING, injected — which bags hold the record at this title. A residency question:
   *  residency rides the envelope, so no byte of the record and no segment of its path can answer it. */
  residencyOf(title: string): Promise<readonly string[]>;
  /** THE RESIDENCY MOVE, injected — the whole-carrier-group transfer, land-then-retract, title preserved. */
  move(move: PromotionMove): Promise<{ ok: true; moved: number } | { ok: false; reason: string }>;
  sign(bytes: Uint8Array): Promise<string>;
  /** The approver's own clock. Injected so a witness reads a fixed one. */
  now?(): string;
}

export interface PromotionPlan {
  /** The tree the relative paths read against. */
  readonly root:    string;
  /** The subject, repo-relative. Read for its declared address, its tags and its hash — never moved. */
  readonly file:    string;
  /** The bag the record leaves. Omitted, it DERIVES from residency where exactly one bag holds the record;
   *  a record standing in two bags names its own ambiguity and the caller resolves it. */
  readonly fromBag?: string;
  /** The canon bag crossed into — the cap is read against this name. */
  readonly destBag?: string;
}

export type PromotionOutcome =
  | { ok: false; reason: string }
  | {
      ok: true;
      /** The record's title — identical either side of the crossing. */
      readonly title:   string;
      readonly fromBag: string;
      readonly toBag:   string;
      /** The subject's own declared address — identical either side of the crossing. */
      readonly subjectUri: string;
      /** The carrier file, at the path it stood at before the crossing and still stands at. */
      readonly carrierFile: string;
      readonly receiptPath: string;
      /** Records the MOVE carried — the carrier group entire, root plus fragments and path children. */
      readonly moved: number;
    };

const DEFAULT_DEST_BAG = "lar:///ha.ka.ba/bags/lares";

/** The declared `uri-path` of a carrier, or null where it declares none. */
function declaredUriPath(src: string): string | null {
  return /^uri-path\s*=\s*"([^"]+)"/m.exec(src)?.[1] ?? null;
}

/** The declared tags, as the meta fence spells them. */
function declaredTags(src: string): string[] {
  const raw = /^tags\s*=\s*\[([^\]]*)\]/m.exec(src)?.[1] ?? "";
  return [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
}

/**
 * Perform one crossing. Every refusal happens BEFORE a record moves, so a refused promotion leaves the tree
 * and the residency it found exactly as they stood — the cap refusal included.
 */
export async function promoteCarrier(plan: PromotionPlan, seat: PromotionSeat): Promise<PromotionOutcome> {
  const abs = isAbsolute(plan.file) ? plan.file : join(plan.root, plan.file);
  let src: string;
  try { src = readFileSync(abs, "utf8"); } catch { return { ok: false, reason: `cannot read ${plan.file}` }; }

  const uriPath = declaredUriPath(src);
  if (!uriPath) return { ok: false, reason: `${plan.file} declares no uri-path — a carrier with no address crosses nothing` };
  // The record's title IS its hostless address. The crossing never changes it; it changes who holds it.
  const title   = `lar:///${uriPath}`;
  const destBag = plan.destBag ?? DEFAULT_DEST_BAG;

  // THE RESIDENCY QUESTION, asked of residency. A path segment cannot answer it: residency rides the
  // envelope, so `docs/` and `api/` in an address say nothing about which bag holds the record.
  const resident = await seat.residencyOf(title);
  if (resident.includes(destBag)) {
    return { ok: false, reason: `${title} already resides in ${destBag} — a crossing never overwrites canon` };
  }
  const live = resident.filter((b) => b !== destBag);
  if (plan.fromBag === undefined && live.length > 1) {
    return { ok: false, reason: `${title} resides in ${live.join(", ")} — name the bag it leaves; a crossing never picks one` };
  }
  const fromBag = plan.fromBag ?? live[0];
  if (!fromBag) {
    return { ok: false, reason: `no bag holds ${title} — a record that never stood on the live layer crosses nothing` };
  }
  if (!resident.includes(fromBag)) {
    return { ok: false, reason: `${fromBag} does not hold ${title} — the record resides in ${live.length > 0 ? live.join(", ") : "no bag"}` };
  }

  const tags = declaredTags(src);
  if (!tags.some((t) => t.startsWith("lifecycle/"))) {
    return { ok: false, reason: "the subject declares no lifecycle — an ungoverned carrier names no state to cross from" };
  }
  if (!tags.includes("lifecycle/standing")) {
    return { ok: false, reason: `the subject stands at ${tags.filter((t) => t.startsWith("lifecycle/")).join(", ")} — only a carrier that has SETTLED crosses into canon` };
  }

  // THE RECEIPT FIRST. A crossing it will not record is a crossing this door will not perform. ONE subject
  // address rides it, the carrier's own, unchanged — the crossing moves the envelope's bag and nothing else.
  const minted = await mintPromotionReceipt({
    subjectUri:     title,
    carrierHash:    bccOf(src) ?? "",
    fromBag,
    toBag:          destBag,
    proposerNym:    seat.proposerNym,
    approverNym:    seat.approverNym,
    approverKeyDid: seat.approverKeyDid,
    subject:        { tags },
    holdsAdmin:     (nym, bag) => seat.holdsAdmin(nym, bag),
    sign:           (bytes) => seat.sign(bytes),
    ...(seat.now ? { now: seat.now } : {}),
    attached:       { carrierFile: plan.file, fromBag },
  });
  if (!minted.ok) return { ok: false, reason: minted.reason };

  // THE MOVE. One primitive performs it: the carrier group entire, landed then retracted, the title
  // preserved throughout. The bytes on disk stay where they are — a residency move re-stamps nothing.
  const moved = await seat.move({ title, fromBag, toBag: destBag });
  if (!moved.ok) return { ok: false, reason: moved.reason };

  const receiptPath = promotionReceiptPath(abs);
  writeFileSync(receiptPath, `${JSON.stringify(minted.receipt, null, 2)}\n`);

  return {
    ok: true,
    title, fromBag, toBag: destBag,
    subjectUri: minted.receipt.assertion.subjectUri,
    carrierFile: plan.file,
    receiptPath,
    moved: moved.moved,
  };
}
