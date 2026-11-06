import { assertKapaeHand, KapaeRefused } from "./promote-kapae.js";
import { kapaeLowerHead, promoteBoardMint, readPromoteAct, readPromoteBoard, signPromoteKapae, signPromotePrepare, type PromoteFace, type SignedPromoteAct } from "./promote-board.js";
import type { PromoteWho } from "./promote.js";
import { cosignPortWitness, WARD_WITNESS_CLOSED, WardActAlreadyRun, wardCosignGate, type WardCosignPort } from "./ward-cosign-gate.js";
import { WARD_GATE_DECIDED } from "./ward-door-decided.js";
import { WardRefused } from "./ward-slots.js";
export { kapaeLowerHead } from "./promote-board.js";

type Signer = { readonly key: string; sign(bytes: Uint8Array): Promise<string> };
export type PromoteBoardDoorPorts = {
  /** The face the door signs under; its board reads compose the co-sign witness from `cosign` at each act. */
  group: string; face: Omit<PromoteFace, "ward">; atom: Signer; epoch(): number; rootSigner(ward?: unknown): Promise<Signer>;
  board: { records(): Promise<readonly unknown[]>; land(act: SignedPromoteAct): Promise<void> };
  projection(): { planes: Readonly<Record<string, string | undefined>> };
  /** The face's intent plane, where a lower's co-sign rides (seat-harness#/the-swarm-slices): every composition hands one, read at the act. */
  cosign(): WardCosignPort | Promise<WardCosignPort>;
};
export function promoteBoardDoor(ports: PromoteBoardDoorPorts) {
  // The door lands what its gate decided (its outcome follows the act); every READ of the board names the co-sign witness.
  const land = async (act: SignedPromoteAct) => {
    const reading = readPromoteAct(act, { ...ports.face, ward: WARD_GATE_DECIDED });
    if (!reading.ok) throw new KapaeRefused("promote-act-refused", reading.refusal);
    await ports.board.land(act); return { cid: reading.cid };
  };
  return {
    async prepare(input: { wiki: string; digest: string; title: string; classes: readonly string[]; why: string }) {
      return land(await signPromotePrepare({ ...input, group: ports.group, epoch: ports.epoch() }, ports.atom));
    },
    async flag(input: { wiki: string; digest: string; title: string; classes: readonly string[]; why: string }) {
      return land(await signPromotePrepare({ ...input, intent: "kapae", group: ports.group, epoch: ports.epoch() }, ports.atom));
    },
    async kapae(input: { action: "raise" | "lower"; wiki: string; digest: string; who: PromoteWho; ward?: unknown }) {
      assertKapaeHand(input.action, input.who);
      if (input.action === "raise") {
        // A RAISE ONLY ADDS A BRAKE, so it fails safe: this device's own atom signs it, under the face's grant chain, and no ward opens.
        const signer = ports.atom;
        if (!ports.face.device(signer.key)) throw new KapaeRefused("device-not-enrolled", "this device's atom stands in no enrolment of the face");
        // A raise fails safe: where the face's plane cannot be read, it cites the heads no lower moved.
        let ward = WARD_WITNESS_CLOSED;
        try { ward = cosignPortWitness(await ports.cosign()); } catch { /* the raise cites the brake's own heads */ }
        const parents = readPromoteBoard(await ports.board.records(), { ...ports.face, ward }).kapaeHeads(input.wiki, input.digest);
        return land(await signPromoteKapae({ group: ports.group, epoch: ports.epoch(), wiki: input.wiki, digest: input.digest, raised: true, parents }, signer));
      }
      // THE CO-SIGN GATE (seat-harness#/the-swarm-slices): a lower names the edge's standing heads, and where the face holds two
      // devices it waits on a second one's answer to that exact act before the ward opens.
      try {
        const port = await ports.cosign();
        const face = { ...ports.face, ward: cosignPortWitness(port) };
        const parents = readPromoteBoard(await ports.board.records(), face).kapaeHeads(input.wiki, input.digest);
        if (!parents.length) throw new KapaeRefused("kapae-nothing-to-lower", "the edge has no heads");
        const head = kapaeLowerHead(input.digest, parents);
        return await wardCosignGate(port, { verb: "ward-kapae-lower", wiki: input.wiki, head }, async () => {
          // A REPLAY RUNS NOTHING: a lower for these very heads already rests on the board (its outcome never landed, so no reader
          // reads it); the gate lands the owed outcome and refuses, and no second lower signs.
          const ran = (await ports.board.records()).some((raw) => {
            const r = readPromoteAct(raw, { ...ports.face, ward: WARD_GATE_DECIDED });
            return r.ok && r.act.body.act === "kapae" && !r.act.body.raised && r.act.body.wiki === input.wiki && r.act.body.digest === input.digest && kapaeLowerHead(input.digest, r.act.body.parents) === head;
          });
          if (ran) throw new WardActAlreadyRun("ward-kapae-lower", head);
          // A LOWER RELEASES A BRAKE: the face root signs it, opened under a fresh ward unlock (seat-harness#/the-ward).
          let signer: Signer;
          try { signer = await ports.rootSigner(input.ward); }
          catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            const ward = /^ward-[a-z-]+/.exec(m)?.[0];
            throw new KapaeRefused(ward ?? "operator-grant-absent", ward ? m : "the grant rests outside custody");
          }
          if (!ports.face.grant(signer.key)) throw new KapaeRefused("operator-grant-absent", "the signer holds no grant");
          // The approval named these heads: a board that moved since then lowers nothing under it.
          const now = readPromoteBoard(await ports.board.records(), face).kapaeHeads(input.wiki, input.digest);
          if (kapaeLowerHead(input.digest, now) !== head) throw new KapaeRefused("kapae-heads-moved", "the edge's heads moved after the co-sign named them; lower again");
          return land(await signPromoteKapae({ group: ports.group, epoch: ports.epoch(), wiki: input.wiki, digest: input.digest, raised: false, parents: now }, signer));
        });
      } catch (e) {
        if (e instanceof WardRefused) throw new KapaeRefused(e.reading, e.message.slice(e.reading.length + 2));
        throw e;
      }
    },
    async mint() { return { url: promoteBoardMint(ports.projection(), ports.group), minted: false as const }; },
  };
}
