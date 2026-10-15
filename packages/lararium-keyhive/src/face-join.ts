/**
 * face-join — the keyhive half of joining an operator's own face, run INSIDE the daemon island.
 *
 * THE SPLIT THIS FILE SERVES. A device-admit confers STANDING: the founder's persona root signs an edge naming
 * the joinee's vessel key, the joinee pins the KEL prefix, and its Binding Gate walks to the head. That edge
 * answers *what this vessel counts as*. It confers no CAPABILITY — a joinee holding only an edge reaches the
 * PersonaGroup's plaintext planes (the self-slot fleet-syncs them same-operator) and decrypts nothing sealed,
 * because keyhive knows no such member. This file closes that second half, and keeps the two apart: a human
 * confers standing once, by hand; the machine completes the capability over the wire.
 *
 * WHY THE daemon ISLAND OWNS IT. The island already holds the booted provider (`operator-daemon-behavior`
 * delegates every freshly minted bag through it), and the event store admits ONE writer. A second process
 * opening its own provider over the same store would stand a second holder against a single-owner store. So
 * the join rides the verb surface every other act rides — and rides it toward the HEARTH. The daemon bag stays
 * sovereign-per-vessel (a joinee seeds its own at admission), so a summons written to a joinee's own plane
 * reaches nobody. The joinee writes onto the HEARTH's daemon doc, by the url the admit payload names, and the
 * outcome lands beside it on that same plane for the joinee to read back.
 *
 * WHAT CROSSES, AND WHY IT MAY. The grant carries `eventsForPeer` output — PUBLIC membership + CGKA ops,
 * encrypted to the joinee's own prekey. No prekey secret, no archive and no application key rides here (the
 * `eventsForPeer` contract), so the grant may sit in a synced doc without leaking a read-cap. The founding path
 * already stores cap-events in the daemon doc for boot hydration; this puts them where that precedent put them.
 *
 * THE GATE IS A SIGNATURE, NEVER A LIST. A vessel keeps no register of the devices it admitted — a roster IS a
 * global now, and this house holds contracts instead. The joinee therefore PRESENTS its edge, and the gate
 * VERIFIES it: signed by this vessel's own persona root, bound to this hearth, unexpired, and naming the very
 * key the presented ContactCard carries. Nothing is looked up, so nothing can drift or be forged by writing to
 * a list. Three of the four checks read the edge alone and run BEFORE the card enters local state.
 *
 * FRESHNESS READS THE LEASE. The LEASE — a per-resource max-register epoch, monotone and read locally — carries
 * the authority: a grant bound below the current epoch reads stale. Connection replay is handled by the summons
 * transport and its fresh exchange; this gate does not turn a wall clock into authority.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/face-join
 */
import { verifyDeviceDelegation, type DeviceDelegationTiddler, type EdgeStanding } from "@lararium/mesh";
import { bytesToBase64 } from "./bytes-base64.js";

/** The summons a joinee writes: what it holds (the card) and what licenses it (the edge). */
export interface FaceJoinSummons {
  readonly kind: "face-join/v1";
  /** The joinee's OWN self-certifying ContactCard (`ContactCard.toJson()`) — it carries the prekey the group
   *  path encrypts to, which a raw verifying key cannot supply. */
  readonly contactCard: string;
  /** The signed root→joinee edge the founder issued. The joinee presents it; the gate verifies it. */
  readonly deviceEdge: DeviceDelegationTiddler;
  /** Force a re-key even when the agent already holds a seat — the answer to a suspected-but-unrevoked
   *  device, where the operator wants a fresh CGKA epoch rather than the existing membership handed back. */
  readonly force?: boolean;
}

/** The grant the island returns — everything the joinee needs to reach the group key, nothing secret. */
export interface FaceJoinGrant {
  readonly kind: "face-join-grant/v1";
  readonly joineeAgentIdHex: string;
  /** The founder's own ContactCard — the joinee receives it so its provider can name this vessel as an
   *  audience. Without it a joinee holds membership yet cannot delegate anything back. */
  readonly founderCard: string;
  /** base64 `eventsForPeer` output — public membership + CGKA ops. */
  readonly capEvents: readonly string[];
  /** True when this call actually added the member (and so re-keyed the group); false when it handed back an
   *  existing seat. A joinee reads it as "the group moved" vs "you were already here". */
  readonly reKeyed: boolean;
  /**
   * The pre-seat chunks RE-SEALED to the group's current key — the reach a seat cannot confer on its own.
   *
   * The PersonaGroup stands as a Keyhive group, so a seat joins the key agreement of every bag the group reaches,
   * and content sealed after the seat opens for the member with no re-delegation. Keyhive reads FORWARD-ONLY: a
   * chunk sealed before this seat stays keyed to an epoch the new member stands outside of and reads `Key not
   * found`. The holder therefore re-encrypts each standing chunk at the current epoch here; the joinee ingests
   * these to reach what the group held before it arrived. Empty when nothing stood sealed on the named bags (a
   * freshly minted bag), or when the provider tracks no content.
   */
  readonly reSealed: readonly { bagUrl: string; contentRefB64: string; ciphertextB64: string }[];
}

export type FaceJoinRefusal = { readonly ok: false; readonly reason: string };
export type FaceJoinOutcome = { readonly ok: true; readonly grant: FaceJoinGrant } | FaceJoinRefusal;

/** What the island supplies. Structural, so a test stands it without a WASM provider. */
export interface FaceJoinProvider {
  receiveContactCard(bytes: Uint8Array): Promise<{ id: string }>;
  verifyGroupMembership(agentIdHex: string, groupId: string): Promise<{ ok: boolean; reason?: string }>;
  addGroupMember(memberIdentifierHex: string, groupId: string): Promise<void>;
  /** Roll one seat: revoke it and say how the key group answered (`KeyhiveProvider.revokeGroupSeat`). A join
   *  for a device that returns while its earlier seat stands runs this first. Absent, such a join refuses. */
  revokeGroupSeat?(memberIdentifierHex: string, groupId: string): Promise<{ how: "revoked" | "gone" | "no-authority" }>;
  /** Re-seal a bag's standing chunks to the group's current key, returning the fresh ciphertext per chunk — the
   *  step a seat cannot do, because keyhive reads FORWARD-ONLY and a chunk sealed before the seat stays keyed to
   *  an epoch the new member stands outside of. Absent when the holder tracks no bag content. */
  reSealBag?(bagUrl: string): Promise<{ contentRef: Uint8Array; ciphertext: Uint8Array }[]>;
  eventsForPeer(peerAgentIdHex: string): Promise<Uint8Array[]>;
  contactCard(): Promise<Uint8Array>;
}

export interface FaceJoinContext {
  /** This vessel's persona-root DID — the ONLY signer whose edge this gate honours. */
  readonly personaRootDid: string;
  /** The hearth true-name an edge must bind to; an edge for another hearth reads as another place's business. */
  readonly hearthTrueName: string;
  /** The PersonaGroup the joinee joins: a Keyhive group's id, which also names the audience its bags delegate to. */
  readonly personaGroupId: string;
  /**
   * The bags whose standing chunks the join RE-SEALS once the seat lands: bags this vessel ALREADY delegated to
   * the group. The seat reaches every such bag's later content by itself (a group carries a seat into the key
   * agreement of every document it reaches); the chunks sealed before it stay keyed to an epoch the member
   * stands outside of, and only a re-seal carries them across. The list grants no reach the group lacks, and it
   * belongs to the caller that knows its own grants.
   */
  readonly reseal?: readonly string[];
  /**
   * THE LEASE AUTHORITY — this resource's current max-register epoch (`effectiveLeaseEpoch` over its slots).
   * A grant whose `boundEpoch` sits below it reads STALE and the gate refuses. A max-register is monotone and
   * read locally, so two islands need no shared clock to agree which way it moved; an unfed resource reads 0
   * and admits the epoch-0 grants a founding issues.
   */
  readonly leaseEpoch: number;
  /**
   * THE DYAD'S READING for the device a summons names, off the fleet's own edge board (kapae#/reach).
   *
   *   · `aside`    — the fleet root set this device aside. The gate answers as though no delegation stood: the
   *                  summons draws the refusal an edge with a false signature draws, word for word, and names
   *                  no cause.
   *   · `returned` — a raise once set the device aside and its lift stands. The seat lands FRESH: the group
   *                  re-keys forward, and NOTHING the group sealed before this seat gets re-sealed to it. A lift
   *                  restores standing, never keys (kapae#/re-admission); a holder hands the missed span over by
   *                  a separate, explicit act alone.
   *   · `owing`    — the same, and the vessel has not yet answered every raise: where the device's earlier seat
   *                  still stands, the join rolls it first (revoke, then a fresh seat), or refuses where this
   *                  hand holds no authority over that seat.
   *   · `clear`    — no raise ever named the device.
   *
   * The caller reads it where the fleet board folds (`edgeStandingOf`), and answers `aside` while that fold has
   * not landed.
   */
  readonly dyad: (deviceVerifyingKey: string) => EdgeStanding;
}

/**
 * The gate, over the EDGE alone. Runs before the card touches local state, so a refused summons leaves the
 * provider exactly as it found it.
 *
 * `cardIdentifierHex` binds the two halves: an edge licenses ONE key, and the card must carry that key, or a
 * holder of somebody else's edge would join under its own identity.
 */
export async function gateFaceJoin(args: {
  readonly edge: DeviceDelegationTiddler;
  readonly ctx: FaceJoinContext;
  /** Absent on the pre-card pass; supplied for the binding check once the card is parsed. */
  readonly cardIdentifierHex?: string;
}): Promise<{ ok: true } | FaceJoinRefusal> {
  const { edge, ctx } = args;

  if (edge?.kind !== "device-delegation") {
    return { ok: false, reason: "the summons carries no device-delegation edge" };
  }
  // The signature check plus the causal lease frontier: the current max-register decides authority.
  const verdict = await verifyDeviceDelegation(edge, ctx.personaRootDid, {
    expectedEpoch: ctx.leaseEpoch,
  });
  if (!verdict.ok) {
    return { ok: false, reason: `edge refused: ${verdict.reason ?? "signature or window"}` };
  }
  // THE BINDING GATE READS THE DYAD'S SHADOW. A device the fleet root set aside binds nothing here, whatever its
  // edge proves. It draws Mu: the words an edge with no relation behind it draws, and no cause.
  if (ctx.dyad(edge.deviceVerifyingKey) === "aside") {
    return { ok: false, reason: "edge refused: signature mismatch" };
  }
  // The binding IS (vessel × hearth) — an edge minted for another place carries no seat at this one.
  if (edge.hearthTrueName !== ctx.hearthTrueName) {
    return { ok: false, reason: "edge binds a different hearth" };
  }
  if (args.cardIdentifierHex !== undefined) {
    // The identifier a card derives ends in the raw verifying key (the relationship the Binding Gate also
    // leans on), so a card presented against somebody else's edge fails here rather than joining.
    if (!args.cardIdentifierHex.toLowerCase().endsWith(edge.deviceVerifyingKey.toLowerCase())) {
      return { ok: false, reason: "the presented card names a different key than the edge licenses" };
    }
  }
  return { ok: true };
}

/**
 * Run the join. Refuses by RETURNING a reason — a summons from an unlicensed vessel names an absent contract,
 * never an attack, and the island keeps serving.
 *
 * Order follows `packPersonaCrossing`: ADD, then CAPTURE. Events captured before the add would carry an epoch
 * the joinee stands outside of.
 */
export async function runFaceJoin(
  provider: FaceJoinProvider,
  summons: FaceJoinSummons,
  ctx: FaceJoinContext,
): Promise<FaceJoinOutcome> {
  // Pass one — the edge alone. Nothing has entered local state yet.
  const edgeVerdict = await gateFaceJoin({ edge: summons.deviceEdge, ctx });
  if (!edgeVerdict.ok) return edgeVerdict;

  if (typeof summons.contactCard !== "string" || summons.contactCard.length === 0) {
    return { ok: false, reason: "the summons carries no contact card" };
  }

  let joineeAgentIdHex: string;
  try {
    const received = await provider.receiveContactCard(new TextEncoder().encode(summons.contactCard));
    joineeAgentIdHex = received.id;
  } catch (err) {
    return { ok: false, reason: `contact card unreadable: ${(err as Error)?.message ?? String(err)}` };
  }

  // Pass two — the card now names a key, so bind it to the edge that licensed the summons.
  const boundVerdict = await gateFaceJoin({ edge: summons.deviceEdge, ctx, cardIdentifierHex: joineeAgentIdHex });
  if (!boundVerdict.ok) return boundVerdict;

  // Membership lives FOUNDER-side, so a joinee that lost its own store still reads as seated here and takes the
  // no-re-key path. That returns its membership, NEVER its keys: keyhive mints fresh prekeys per init, and the
  // group's already-sealed material stays keyed to the prekeys that vessel held when it was seated. A wiped
  // store recovers from its ARCHIVE (`keyhive-provider` init: RESTORE-OR-FRESH) and from nothing here — force
  // re-keys the group and still opens none of it. A seat is not a key.
  //
  // A joinee whose group was re-founded holds no seat in the NEW group, so the add genuinely runs.
  const seated = await provider.verifyGroupMembership(joineeAgentIdHex, ctx.personaGroupId);
  const addUnlessRolled = summons.force === true || !seated.ok;
  // A DEVICE THAT RETURNS AFTER A LIFT TAKES A FRESH SEAT AND NO EARLIER KEY. The seat reaches each bag FORWARD;
  // the re-seal that would carry the standing chunks across stays out, since those chunks hold the span the
  // device missed.
  const dyad = ctx.dyad(summons.deviceEdge.deviceVerifyingKey);
  const returned = dyad === "returned" || dyad === "owing";
  // THE EARLIER SEAT LEAVES FIRST. A device that returns while a raise still owes its roll may hold the very seat
  // the raise names, and its earlier key epoch with it. So the join rolls the seat before it seats: revoke, then add.
  // Where this hand holds no authority over the earlier seat, or no revoke capability at all, the join REFUSES:
  // the raise still owes its roll, and the vessel that seated the device answers it first (kapae#/keys).
  let rolledFirst = false;
  if (dyad === "owing" && seated.ok) {
    const how = provider.revokeGroupSeat ? (await provider.revokeGroupSeat(joineeAgentIdHex, ctx.personaGroupId)).how : "no-authority";
    if (how === "no-authority") {
      return { ok: false, reason: "the earlier seat still stands and its roll stays owed — the vessel that seated this device answers the raise first, and the join then seats afresh" };
    }
    rolledFirst = true;
  }
  const mustAdd = addUnlessRolled || rolledFirst;
  const reSealed: { bagUrl: string; contentRefB64: string; ciphertextB64: string }[] = [];
  if (mustAdd) {
    await provider.addGroupMember(joineeAgentIdHex, ctx.personaGroupId);
    // The seat joins the key agreement of every bag the group reaches, FORWARD only. A chunk the group held before
    // this seat stays keyed to an epoch the member stands outside of, so RE-SEAL each standing chunk at the
    // group's current key, after the add. Absent a re-seal capability, or an empty bag, this adds nothing and the
    // pre-seat chunks stay unreached, visibly (an empty `reSealed`).
    for (const bagUrl of returned ? [] : (ctx.reseal ?? [])) {
      for (const chunk of (await provider.reSealBag?.(bagUrl)) ?? []) {
        reSealed.push({
          bagUrl,
          contentRefB64: bytesToBase64(chunk.contentRef),
          ciphertextB64: bytesToBase64(chunk.ciphertext),
        });
      }
    }
  }

  // CAPTURE LAST — the events must carry the add AND every re-seal above, or the joinee ingests a membership whose
  // re-sealed chunks open under no key it holds (the add→encrypt→capture order `packPersonaCrossing` also keeps).
  const events = await provider.eventsForPeer(joineeAgentIdHex);
  const founderCard = new TextDecoder().decode(await provider.contactCard());

  return {
    ok: true,
    grant: {
      kind: "face-join-grant/v1",
      joineeAgentIdHex,
      founderCard,
      capEvents: events.map(bytesToBase64),
      reKeyed: mustAdd,
      reSealed,
    },
  };
}
