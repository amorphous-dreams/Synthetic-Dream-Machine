/**
 * runEdgeKapae — set a relationship aside, or take the marker back down.
 *
 * TWO HANDS, TWO BOARDS (kapae#/edge-hands · #/four-edges).
 *   · The HOLDER hand signs with one persona root this vessel holds: a voucher over their own vouch, on the
 *     realm's edge board; or a fleet root over a device of its fleet, on the fleet's edge board.
 *   · The QUORUM hand signs with the seats of this vessel's charter that it holds, at the charter's head
 *     epoch, on the realm's edge board: a vouch struck, or a member's whole relation to the realm set aside.
 *     Fewer held seats than the threshold refuses before any write.
 *
 * THE DOOR READS AUTHORITY THE WAY EVERY READER DOES. On a realm's board the holder of a vouch edge reads off
 * the verified vouches this vessel holds (`realmEdgeAuthority`): its voucher, and no other key. A root that
 * holds no vouch under the edge it names meets a refusal and writes nothing, so the door never reports a shadow
 * no reader would count. On a fleet's board the signing root holds every edge. Whether an act counts still gets
 * decided at each reader's own fold; this door only declines to write one it can already see dropping.
 *
 * THE ACT CITES THE LINE'S OWN HEADS, read through the counting fold, at whatever epoch each head roots on. A
 * lift after a seal roll therefore cites the raise it lifts by id (kapae#/rolls). No scalar stands in for
 * causality, and no caller types an epoch: the charter's head names it.
 *
 * RAISING AND LOWERING STAY SYMMETRIC IN SHAPE AND ASYMMETRIC IN FORCE: both write one signed act, and only
 * the fold knows that a raise wins a tie. So a lower may LAND and the shadow still stand, and the result says
 * so (`shadowStands`, `verdict`) rather than reporting the gesture.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  signEdgeKapae, writeEdgeKapae, edgeLineHeads,
  realmEdgeBoardDocUrl, fleetEdgeBoardDocUrl, ed25519SignerFromSeed, memberEdgeId, deviceEdgeId,
  realmEdgeAuthority, readLedgeredVouches, withdrawForRemoval,
  type DeviceCertificateHeld, type DeviceWithdrawalReport, type FaceWithdrawal, type EdgeAuthority, type EdgeHand, type EdgeKapaeVerdict, type EdgeSigner,
} from "@lararium/mesh";
import {
  listPersonaRoots, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey,
} from "../node-vessel-identity.js";
import { selectHeldQuorumSigners } from "../held-quorum.js";
import { readVesselEdgeBoard, vesselEdgeCharter } from "../edge-board.js";

export class EdgeKapaeError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;

export interface EdgeKapaeOptions {
  /** The relationship to act on, by id — a vouch edge id, a member edge id, a device edge id. */
  readonly edgeId?:      string;
  /** Or by its far end: a MEMBER's key, naming that member's whole relation to `realm` (the quorum's edge). */
  readonly member?:      string;
  /** Or a DEVICE's key, naming that device's relation to the signing root's fleet (the fleet root's edge). */
  readonly device?:      string;
  /** true → raise the shadow (set aside); false → lower it (a deliberate re-admission). */
  readonly raised:       boolean;
  /** Which hand signs. Absent → the holder. */
  readonly hand?:        EdgeHand;
  /** The realm whose edge board carries the act. Absent → the fleet's own board, under the signing root. */
  readonly realm?:       string;
  /** The holder hand: WHICH held persona root signs. Absent → the first held root. */
  readonly handleIndex?: number;
  /** Explicit causal parents; absent means the line's own heads as this vessel counts them. */
  readonly parents?:     readonly string[];
  /** The charter DOC's authority home (the door supplies `larSealHome()`). */
  readonly sealHome:     string;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:         Repo;
  /**
   * THE DEVICE'S FACE CERTIFICATES, as this vessel's own private state holds them: for a device raise, the door
   * signs one certificate withdrawal for each (`withdrawForRemoval`), beside the dyad marker. `keep` rests each
   * signed event and its history where the face's own causal state lives. Absent: no reader of that state
   * stands composed, the door signs the marker alone, and its result says so by name.
   */
  readonly faceCertificates?: {
    readonly held: (fleetRoot: string, deviceKey: string) => Promise<readonly DeviceCertificateHeld[]>;
    readonly keep: (signed: DeviceWithdrawalReport["signed"][number]) => Promise<void>;
  };
}

/** What a device raise did about the device's face certificates (face-proof#/the-withdrawal-proof). */
export interface DeviceWithdrawals {
  /** How many withdrawals this call signed, and how many scopes already denied the key. */
  readonly signed:   number;
  readonly standing: number;
  /** Each withdrawal this vessel could not sign, by face key, Nexus and reason. */
  readonly unsigned: readonly { readonly faceKey: string; readonly nexus: string; readonly why: string }[];
  /** Every withdrawal event this call signed, kept or not: the caller holds them for a retry. */
  readonly events:   readonly FaceWithdrawal[];
  /** Set where this vessel reads no record of the device's certificates at all: nothing got signed. */
  readonly unread?:  string;
}

export interface EdgeKapaeResult {
  readonly edgeId:    string;
  readonly raised:    boolean;
  readonly hand:      EdgeHand;
  readonly actCid:    string;
  readonly parents:   readonly string[];
  readonly epochCid:  string;
  /** Every key that signed: one for the holder hand, the held seats for the quorum hand. */
  readonly signers:   readonly string[];
  /** Which board carries the act: one realm's, or one fleet's. */
  readonly board:     "realm" | "fleet";
  readonly boardUrl:  string;
  /** Whether the shadow STANDS after this act, read back through the counting fold under this hand. */
  readonly shadowStands: boolean;
  /**
   * Why — the reading for this edge after the act. `unsettled` names a FORK: a raise and a lower stand with no
   * causal order between them, the shadow stays up, and a later act citing both heads settles it. Absent when
   * the act did not survive the counting fold.
   */
  readonly verdict?: EdgeKapaeVerdict;
  /** A device RAISE alone: the second act of the removal, signed or reported by name. */
  readonly withdrawals?: DeviceWithdrawals;
}

/** Land one kāpae act on its board. `now` never enters — an act carries an order, never an instant. */
export async function runEdgeKapae(opts: EdgeKapaeOptions): Promise<EdgeKapaeResult> {
  const hand: EdgeHand = opts.hand ?? "holder";
  const realm = opts.realm?.trim().toLowerCase();
  const bareKey = (v: string): string => v.trim().toLowerCase().replace(/^0x/, "");
  const member = opts.member !== undefined ? bareKey(opts.member) : undefined;
  const device = opts.device !== undefined ? bareKey(opts.device) : undefined;

  if ([opts.edgeId, member, device].filter((v) => v !== undefined).length !== 1) {
    throw new EdgeKapaeError("name ONE relationship: an edge id, a member's key (with a realm), or a device's key.");
  }
  if (realm !== undefined && !HEX64.test(realm)) throw new EdgeKapaeError(`--realm expects a 64-hex realm id, got "${opts.realm}".`);
  if (member !== undefined && (!HEX64.test(member) || realm === undefined)) {
    throw new EdgeKapaeError("a member's edge takes the member's 64-hex key and the realm it stands in.");
  }
  if (device !== undefined && (!HEX64.test(device) || realm !== undefined || hand !== "holder")) {
    throw new EdgeKapaeError("a device's edge takes the device's 64-hex key and the fleet root's own hand; it rides no realm's board.");
  }
  let edgeId = member !== undefined ? memberEdgeId(realm!, member) : (opts.edgeId ?? "").trim().toLowerCase();
  if (device === undefined && !HEX64.test(edgeId)) throw new EdgeKapaeError("an edge id names the relationship to act on — expected 64 hex.");
  if (hand === "quorum" && realm === undefined) {
    throw new EdgeKapaeError("the quorum hand acts on a realm's edge board — name the realm. A fleet's edge answers to its root alone.");
  }

  const vesselKey = await loadVesselVerifyingKey();
  if (!vesselKey) throw new EdgeKapaeError("this vessel surfaces no verifying key — it keeps no ledger to read a board against.");
  const charter = realm !== undefined ? vesselEdgeCharter(realm, opts.sealHome) : null;

  let signers: EdgeSigner[];
  let authority: EdgeAuthority;
  let scope: string;
  let boardUrl: ReturnType<typeof realmEdgeBoardDocUrl>;
  let epochCid: string;

  if (hand === "quorum") {
    if (!charter) throw new EdgeKapaeError("no seated charter stands on this vessel — the quorum hand has no seats to sign with.");
    const selected = await selectHeldQuorumSigners(charter.head, (held, k) => new EdgeKapaeError(
      `REFUSED (fail-closed): this vessel holds ${held} seat(s) of the charter's quorum and the act takes ${k}. ` +
      "A quorum act never lands short of its threshold.",
    ));
    signers = await Promise.all(selected.map(async (s) => ({
      signer: s.verifyingKey, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(s.handleIndex)),
    })));
    authority = { quorum: true };
    scope = realm!;
    boardUrl = realmEdgeBoardDocUrl(realm!);
    epochCid = charter.head.sealEpochCid;
  } else {
    const held = await listPersonaRoots();
    if (held.length === 0) {
      throw new EdgeKapaeError("no persona root held on this vessel — an act carries a signature, and this vessel signs with none.");
    }
    const handleIndex = opts.handleIndex ?? held[0]!;
    if (!held.includes(handleIndex)) {
      throw new EdgeKapaeError(`persona root ${handleIndex} is not held here (held: ${held.join(", ")}).`);
    }
    const signerDid = (await loadPersonaGroupRootVerifyingKey(handleIndex))?.toLowerCase();
    if (!signerDid) {
      throw new EdgeKapaeError(`persona root ${handleIndex} surfaces no usable verifying key — nothing to sign with.`);
    }
    signers = [{ signer: signerDid, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex)) }];
    authority = { holder: signerDid };
    if (device !== undefined) edgeId = deviceEdgeId(signerDid, device);   // the fleet root and the device key name it
    scope = realm ?? signerDid;
    boardUrl = realm !== undefined ? realmEdgeBoardDocUrl(realm) : fleetEdgeBoardDocUrl(signerDid);
    // A holder act carries the charter's head where one stands; no reader checks it (kapae#/rolls).
    epochCid = charter?.head.sealEpochCid ?? "no-charter";
  }

  const repo = opts.repo;
  const acted = edgeId;
  // WHO HOLDS THE EDGE, as any reader would find it. A realm's board: the verified vouches name each vouch
  // edge's voucher, and the seat quorum holds every edge. A fleet's board: the signing root holds every edge.
  let authorityFor: (id: string) => EdgeAuthority | undefined;
  if (realm !== undefined) {
    const vouches = await readLedgeredVouches({ repo, realm, vesselKey });
    authorityFor = realmEdgeAuthority(vouches.invites);
    if (hand === "holder") {
      const holder = authorityFor(acted)?.holder?.toLowerCase().replace(/^0x/, "");
      if (holder !== authority.holder) {
        throw new EdgeKapaeError(
          holder === undefined
            ? "REFUSED: no single key holds that edge on this realm's board. A voucher holds their own vouch " +
              "(name its edge id, as `lares cabal vouch` printed it); a member's edge answers to the seat quorum (--quorum)."
            : "REFUSED: that vouch belongs to another voucher. Only the root that made a vouch withdraws it; the seat quorum may strike it (--quorum).",
        );
      }
    }
  } else {
    authorityFor = () => authority;
  }
  try {
    const kind = realm !== undefined ? "realm" as const : "fleet" as const;
    const before = await readVesselEdgeBoard({
      repo, scope, kind, boardUrl, label: "board:edge-kapae", vesselKey, authorityFor, charter,
    });
    const heads = edgeLineHeads(before.counted.acts, edgeId, hand);
    const parents = [...(opts.parents ?? heads)].sort();
    if (opts.parents && opts.parents.some((p) => !heads.includes(p))) {
      throw new EdgeKapaeError("refusing raw or non-frontier parent: parents name heads of this edge's own line, as this vessel counts them.");
    }

    const act = await signEdgeKapae({ edgeId, raised: opts.raised, hand, parents, epochCid }, signers);
    before.handle.change((d) => writeEdgeKapae(d, act));
    await repo.flush();

    // Read the act BACK through the counting fold. A caller learns whether the shadow now STANDS rather than
    // merely whether a tiddler landed, and the read keeps the act in this vessel's own ledger.
    const after = await readVesselEdgeBoard({
      repo, scope, kind, boardUrl, label: "board:edge-kapae", vesselKey, authorityFor, charter,
    });
    await repo.flush();
    const reading = after.readings.get(edgeId);
    // THE SECOND ACT (kapae#/reach). A dyad marker closes nothing at a Nexus gate, so a device raise signs one
    // certificate withdrawal for each face key the device holds a certificate under, or reports by name each
    // one it could not sign. The marker stands either way: a withdrawal this vessel cannot sign never holds
    // the fleet's own removal back.
    let withdrawals: DeviceWithdrawals | undefined;
    if (device !== undefined && opts.raised) {
      if (!opts.faceCertificates) {
        withdrawals = { signed: 0, standing: 0, unsigned: [], events: [], unread: "this vessel reads no record of that device's face certificates, so it signed no withdrawal: a gate that holds no denial still accepts a certificate the device holds" };
      } else {
        // The marker already landed. Nothing below may lose it or hide what got signed: a read that fails and a
        // save that fails each land in the report by name, and every signed event rides out for a retry.
        let held: readonly DeviceCertificateHeld[] | null = null, unread: string | undefined;
        try { held = await opts.faceCertificates.held(scope, device); }
        catch (err) { unread = `this vessel could not read that device's face certificates (${err instanceof Error ? err.message : String(err)}), so it signed no withdrawal`; }
        if (held === null) withdrawals = { signed: 0, standing: 0, unsigned: [], events: [], unread: unread! };
        else {
          const report = await withdrawForRemoval(held);
          const unsigned = report.unsigned.map((u) => ({ faceKey: u.scope.faceKey, nexus: u.scope.nexus, why: u.why }));
          for (const s of report.signed) {
            try { await opts.faceCertificates.keep(s); }
            catch (err) { unsigned.push({ faceKey: s.scope.faceKey, nexus: s.scope.nexus, why: `signed-and-not-kept: ${err instanceof Error ? err.message : String(err)}` }); }
          }
          withdrawals = { signed: report.signed.length, standing: report.standing.length, unsigned, events: report.signed.map((s) => s.event) };
        }
      }
    }
    return {
      ...(withdrawals ? { withdrawals } : {}),
      edgeId, raised: opts.raised, hand, actCid: act.actCid, parents, epochCid,
      signers: signers.map((s) => s.signer), board: realm !== undefined ? "realm" : "fleet", boardUrl,
      shadowStands: reading?.stands ?? false, ...(reading !== undefined ? { verdict: reading.verdict } : {}),
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

