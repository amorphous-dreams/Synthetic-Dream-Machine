import { assertKapaeHand, KapaeRefused } from "./promote-kapae.js";
import { promoteBoardMint, readPromoteAct, readPromoteBoard, signPromoteKapae, signPromotePrepare, type PromoteFace, type SignedPromoteAct } from "./promote-board.js";
import type { PromoteWho } from "./promote.js";

type Signer = { readonly key: string; sign(bytes: Uint8Array): Promise<string> };
export type PromoteBoardDoorPorts = {
  group: string; face: PromoteFace; atom: Signer; epoch(): number; rootSigner(): Promise<Signer>;
  board: { records(): Promise<readonly unknown[]>; land(act: SignedPromoteAct): Promise<void> };
  projection(): { planes: Readonly<Record<string, string | undefined>> };
};
export function promoteBoardDoor(ports: PromoteBoardDoorPorts) {
  const land = async (act: SignedPromoteAct) => {
    const reading = readPromoteAct(act, ports.face);
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
    async kapae(input: { action: "raise" | "lower"; wiki: string; digest: string; who: PromoteWho }) {
      assertKapaeHand(input.action, input.who);
      let signer: Signer;
      if (input.action === "raise") {
        // A RAISE ONLY ADDS A BRAKE, so it fails safe: this device's own atom signs it, under the face's grant chain, and no ward opens.
        signer = ports.atom;
        if (!ports.face.device(signer.key)) throw new KapaeRefused("device-not-enrolled", "this device's atom stands in no enrolment of the face");
      } else {
        // A LOWER RELEASES A BRAKE: the face root signs it, opened under a fresh ward unlock (seat-harness#/the-ward).
        try { signer = await ports.rootSigner(); }
        catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          const ward = /^ward-[a-z-]+/.exec(m)?.[0];
          throw new KapaeRefused(ward ?? "operator-grant-absent", ward ? m : "the grant rests outside custody");
        }
        if (!ports.face.grant(signer.key)) throw new KapaeRefused("operator-grant-absent", "the signer holds no grant");
      }
      const board = readPromoteBoard(await ports.board.records(), ports.face), parents = board.kapaeHeads(input.wiki, input.digest);
      if (input.action === "lower" && !parents.length) throw new KapaeRefused("kapae-nothing-to-lower", "the edge has no heads");
      return land(await signPromoteKapae({ group: ports.group, epoch: ports.epoch(), wiki: input.wiki, digest: input.digest, raised: input.action === "raise", parents }, signer));
    },
    async mint() { return { url: promoteBoardMint(ports.projection(), ports.group), minted: false as const }; },
  };
}
