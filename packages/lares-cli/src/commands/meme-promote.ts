/**
 * meme-promote — THE PRIESTHOOD ACT, PERFORMED AND RECORDED.
 *
 * `lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary` names the blocker plainly: a
 * promotion into a canon bag is PERMITTED by capability and RECORDED by nothing. `mintPromotionReceipt`
 * (`@lararium/mesh`) built the record. This module performs the crossing the record describes, and refuses
 * to perform one it could not record.
 *
 * ── THE CROSSING, IN ORDER ──────────────────────────────────────────────────────────────────────
 *   · READ the subject and its declared address. A carrier outside a `docs/` segment names no crossing —
 *     it is either already canon or never lived on the live layer.
 *   · REFUSE an ungoverned carrier, and one standing off `lifecycle/standing`. The boundary crosses a thing
 *     with a LIFECYCLE, and only from the state that has settled: a lean, a fold, a draft names a state the
 *     crossing has no meaning from.
 *   · MINT THE RECEIPT FIRST, cap reading and all. The refusals run BEFORE anything moves, so a refused
 *     promotion leaves a tree byte-identical to the one it found — including the cap refusal, which is the
 *     one a hand is most likely to meet.
 *   · MOVE the bytes, rewrite `uri-path` and `file-path` and the carrier's own address mark, WELD every
 *     inbound edge across the named corpus, and re-stamp each carrier the weld touched.
 *   · WRITE the receipt BESIDE the promoted carrier (`promotionReceiptPath` — the mesh module already rules
 *     where it rests: sharing the carrier's name, so a reader holding the carrier holds the record of how it
 *     arrived, with no index to consult and none to fall out of step).
 *
 * ── THE SEAT ARRIVES INJECTED ───────────────────────────────────────────────────────────────────
 * The receipt module "holds no key and reads no cap"; this door keeps the same discipline one layer out. The
 * proposer, the approver, its key, its signer and the ADMIN READING are all arguments, so the whole crossing
 * runs in a witness with no vessel, no keyring and no daemon — and the cap refusal is testable without one.
 *
 * AND THE CLI HAS NO ADMIN ORACLE TO WIRE. Measured: nothing in `packages/lares-cli/src` reads
 * `cap("admin", <bag>)` — no door, no helper, no verb. So the terminal seat refuses by default rather than
 * inventing a reading, which is the fail-closed answer and names the one thing still owed.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { mintPromotionReceipt, promotionReceiptPath } from "@lararium/mesh";
import { readCarrierEdges, bccOf, verifyBcc, checkSpan } from "@lararium/tw5";

/** The hand that approves the crossing, and the readings it brings. Nothing here is discovered. */
export interface PromotionSeat {
  readonly proposerNym:    string;
  readonly approverNym:    string;
  readonly approverKeyDid: string;
  /** The cap reading, injected — this module opens no keyring and resolves no delegation. */
  holdsAdmin(nym: string, bag: string): Promise<boolean>;
  sign(bytes: Uint8Array): Promise<string>;
  /** The approver's own clock. Injected so a witness reads a fixed one. */
  now?(): string;
}

export interface PromotionPlan {
  /** The tree the relative paths read against. */
  readonly root:   string;
  /** The subject, repo-relative (`bags/…/docs/pono/x.mem`). */
  readonly file:   string;
  /** The carriers the weld reads and may rewrite, repo-relative. The edge counts read over exactly these. */
  readonly corpus: readonly string[];
  /** The canon bag crossed into — the cap is read against this name. */
  readonly destBag?: string;
}

export type PromotionOutcome =
  | { ok: false; reason: string }
  | {
      ok: true;
      readonly from: string; readonly to: string;
      readonly sourceUri: string; readonly targetUri: string;
      readonly receiptPath: string;
      /** How many carriers the weld rewrote. */
      readonly welded: number;
      readonly edgesBefore: number; readonly edgesAfter: number;
      readonly danglingBefore: number; readonly danglingAfter: number;
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

/** Re-stamp a carrier's block check over the body it follows — the same law `meme normalize` keeps. */
function restamp(text: string): string {
  if (verifyBcc(text) !== "mismatch") return text;
  const span = checkSpan(text);
  const want = bccOf(text);
  if (!span || !want) return text;
  return text.slice(0, span.end)
       + text.slice(span.end).replace(/^ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, want);
}

/** The addresses a corpus HOLDS, and the edges it carries — the `meme check --edges` reading, in process. */
function edgeReading(root: string, corpus: readonly string[]): { edges: number; dangling: number } {
  const held = new Set<string>();
  const texts: string[] = [];
  for (const rel of corpus) {
    const abs = isAbsolute(rel) ? rel : join(root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf8");
    texts.push(src);
    const uri = declaredUriPath(src);
    if (uri) held.add(uri);
  }
  let edges = 0, dangling = 0;
  for (const src of texts) {
    for (const e of readCarrierEdges(src)) {
      if (e.address === null) continue;      // names a FILE, never an address — it cannot dangle
      edges += 1;
      if (!held.has(e.address)) dangling += 1;
    }
  }
  return { edges, dangling };
}

/**
 * Perform one crossing. Every refusal happens BEFORE a byte moves, so a refused promotion leaves the tree
 * exactly as it found it — the cap refusal included.
 */
export async function promoteCarrier(plan: PromotionPlan, seat: PromotionSeat): Promise<PromotionOutcome> {
  const abs = isAbsolute(plan.file) ? plan.file : join(plan.root, plan.file);
  let src: string;
  try { src = readFileSync(abs, "utf8"); } catch { return { ok: false, reason: `cannot read ${plan.file}` }; }

  const sourceUriPath = declaredUriPath(src);
  if (!sourceUriPath) return { ok: false, reason: `${plan.file} declares no uri-path — a carrier with no address crosses nothing` };
  if (!sourceUriPath.includes("/docs/")) {
    return { ok: false, reason: `${sourceUriPath} names no \`docs/\` segment — it stands in canon already, or it never stood on the live layer` };
  }
  const targetUriPath = sourceUriPath.replace("/docs/", "/api/");
  const targetRel     = plan.file.replace("/docs/", "/api/");
  const targetAbs     = isAbsolute(targetRel) ? targetRel : join(plan.root, targetRel);
  if (existsSync(targetAbs)) return { ok: false, reason: `${targetRel} already stands — a crossing never overwrites canon` };

  const destBag = plan.destBag ?? DEFAULT_DEST_BAG;
  const tags = declaredTags(src);
  if (!tags.some((t) => t.startsWith("lifecycle/"))) {
    return { ok: false, reason: "the subject declares no lifecycle — an ungoverned carrier names no state to cross from" };
  }
  if (!tags.includes("lifecycle/standing")) {
    return { ok: false, reason: `the subject stands at ${tags.filter((t) => t.startsWith("lifecycle/")).join(", ")} — only a carrier that has SETTLED crosses into canon` };
  }

  // THE RECEIPT FIRST. Its four refusals are the boundary's own prose, and a crossing it will not record is
  // a crossing this door will not perform.
  const minted = await mintPromotionReceipt({
    // The SOURCE is hostful: it names WHO spoke, under what grant, from where — the live layer's own shape.
    sourceUri:      `lar://${seat.proposerNym}@hearth/${sourceUriPath}`,
    targetUri:      `lar:///${targetUriPath}`,
    carrierHash:    bccOf(src) ?? "",
    destBag,
    proposerNym:    seat.proposerNym,
    approverNym:    seat.approverNym,
    approverKeyDid: seat.approverKeyDid,
    subject:        { tags },
    holdsAdmin:     (nym, bag) => seat.holdsAdmin(nym, bag),
    sign:           (bytes) => seat.sign(bytes),
    ...(seat.now ? { now: seat.now } : {}),
    attached:       { sourceFile: plan.file, targetFile: targetRel, corpus: plan.corpus.length },
  });
  if (!minted.ok) return { ok: false, reason: minted.reason };

  const before = edgeReading(plan.root, plan.corpus);

  // THE MOVE. The carrier's own address mark, its declared address, and its declared path all name the same
  // crossing, so all three move together or none does.
  const moved = restamp(src
    .split(sourceUriPath).join(targetUriPath)
    .split(plan.file).join(targetRel));
  mkdirSync(dirname(targetAbs), { recursive: true });
  writeFileSync(targetAbs, moved);
  rmSync(abs, { force: true });

  // THE WELD. Every carrier pointing at the old address follows it; a carrier pointing elsewhere is untouched,
  // and each one the weld rewrites gets its block check re-stamped over the body the weld left.
  let welded = 0;
  for (const rel of plan.corpus) {
    if (rel === plan.file) continue;
    const other = isAbsolute(rel) ? rel : join(plan.root, rel);
    if (!existsSync(other)) continue;
    const text = readFileSync(other, "utf8");
    if (!text.includes(sourceUriPath)) continue;
    writeFileSync(other, restamp(text.split(sourceUriPath).join(targetUriPath)));
    welded += 1;
  }

  const after = edgeReading(plan.root, plan.corpus.map((c) => (c === plan.file ? targetRel : c)));
  const receiptPath = promotionReceiptPath(targetAbs);
  writeFileSync(receiptPath, `${JSON.stringify(minted.receipt, null, 2)}\n`);

  return {
    ok: true,
    from: plan.file, to: targetRel,
    sourceUri: minted.receipt.assertion.sourceUri,
    targetUri: minted.receipt.assertion.targetUri,
    receiptPath,
    welded,
    edgesBefore: before.edges, edgesAfter: after.edges,
    danglingBefore: before.dangling, danglingAfter: after.dangling,
  };
}
