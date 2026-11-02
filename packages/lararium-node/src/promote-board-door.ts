import { assertKapaeHand, KapaeRefused, promoteBoardMint, readPromoteAct, readPromoteBoard, signPromoteKapae, signPromotePrepare, type PromoteFace, type PromoteWho, type SignedPromoteAct } from "@lararium/mesh";

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
    async kapae(input: { action: "raise" | "lower"; wiki: string; digest: string; who: PromoteWho }) {
      assertKapaeHand(input.action, input.who);
      let signer: Signer;
      try { signer = await ports.rootSigner(); } catch { throw new KapaeRefused("operator-grant-absent", "the grant rests outside custody"); }
      if (!ports.face.grant(signer.key)) throw new KapaeRefused("operator-grant-absent", "the signer holds no grant");
      const board = readPromoteBoard(await ports.board.records(), ports.face), parents = board.kapaeHeads(input.wiki, input.digest);
      if (input.action === "lower" && !parents.length) throw new KapaeRefused("kapae-nothing-to-lower", "the edge has no heads");
      return land(await signPromoteKapae({ group: ports.group, epoch: ports.epoch(), wiki: input.wiki, digest: input.digest, raised: input.action === "raise", parents }, signer));
    },
    async mint() { return { url: promoteBoardMint(ports.projection(), ports.group), minted: false as const }; },
  };
}
