/**
 * rite-kukulu — the kūkulu rite's order: a vessel raised again around its hearth, with a tessera kept across the gap.
 *
 * The rite runs on the host, behind four ports, in one order:
 *
 *   1. checkout     the checkout's head and branch
 *   2. rite-begin   IN THE VESSEL: derive the head's tree, and for every lent face return that face's own kukulu lei and
 *                   rest its guest half (`rite-begun`); a face whose lei is missing waits by name
 *   3. shim build   rebuild the vessel's image from the committed checkout
 *   3a. rite-offer  IN THE VESSEL, where the host names the image it built (`image`): gather every lent face's line, sign
 *                   one vouch per face over that image, and rest the offer the new vessel carries to the pūlama (`kukulu-offer.json`)
 *   4. shim down    the standing vessel goes down
 *   5. shim up      a new vessel stands
 *   6. rite-land    IN THE NEW VESSEL: rest each face's host half (`rite-landed`) under that face, naming its begun half and
 *                   the head it stands at; the rite reads par only where every pair reads par
 *
 * THE RITE BEGINS BEFORE THE VESSEL GOES DOWN. A begin the vessel refuses (no lei, no testimony, no return left) runs no shim
 * verb at all. The return comes first by design, so a build that fails leaves the lei's return spent and the begun half
 * waiting: conferre reads it red at the next wake, and the vessel still stands.
 *
 * THE NEW VESSEL COMES BACK LOCKED until a holder keeps its hearth lit across the rebuild (the pūlama, road L47). A locked
 * vessel refuses the landing; the rite then ends clean, names the unlock and the landing still owed, and the wake reads the
 * begun half red until someone lands it.
 *
 * The host names the head it built from (the shim refuses a dirty checkout and stamps that head on the image), and the vessel
 * signs the landing under it.
 *
 * THE SEED THE IMAGE OFFERS (D1). Before the build, the host says the seed (offered) at the head beside the founding record
 * (the stored genesis island), ratchet by ratchet (`seedOffer`, `kukuluSeedLine`). The kūkulu moves no ratchet: the new
 * vessel serves the founding record it reloads, and the line only names what waits.
 */
import { compareGenesisDigests, ratchetWords, ratchetsDiffer, type GenesisDigests } from "@lararium/mesh";

export type RiteVerbAnswer =
  | { readonly ok: true; readonly output: Record<string, unknown> }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface RitePorts {
  /** The checkout's head and the branch it rides. */
  checkout(): Promise<{ readonly head: string; readonly branch: string }>;
  /** One store row, answered by the vessel that stands (or the offline door where none does). */
  row(verb: "rite-begin" | "rite-land" | "rite-offer", args: Record<string, unknown>): Promise<RiteVerbAnswer>;
  /** The digest of the image the build left, as the HOST reads it; null where the host names none. Absent, the rite writes no offer. */
  image?(): Promise<string | null>;
  /** One verb of the host shim; the answer carries its exit code. */
  shim(verb: "build" | "down" | "up"): Promise<number>;
  say(line: string): void;
  /**
   * The founding record's digests beside the seed the image at `head` offers (its CID and digests); null where the host reads
   * no founding record. Absent, the rite says nothing of the seed.
   */
  seedOffer?(head: string): Promise<SeedOffer | null>;
}

/** The founding record beside the seed an image offers. */
export interface SeedOffer {
  readonly record: GenesisDigests;
  readonly seed: { readonly cid: string; readonly digests: GenesisDigests };
}

/** The kūkulu's seed line: the seed the image at `head` offers beside the founding record, ratchet by ratchet. */
export function kukuluSeedLine(head: string, offer: SeedOffer): string {
  const ratchets = compareGenesisDigests(offer.record, offer.seed.digests);
  return ratchetsDiffer(ratchets)
    ? `kūkulu: the image at ${head} offers seed ${offer.seed.cid} beside the founding record: a newer seed waits: ${ratchetWords(ratchets)}; the founding record keeps serving, and the kūkulu moves no ratchet`
    : `kūkulu: the image at ${head} offers seed ${offer.seed.cid}: same on every ratchet as the founding record`;
}

export const RITE_KUKULU = "kukulu";

export async function riteKukulu(ports: RitePorts, opts: { readonly branch?: string }): Promise<{ code: number; data: Record<string, unknown> }> {
  const checkout = await ports.checkout();
  const head = checkout.head, branch = opts.branch ?? checkout.branch;
  const base = { rite: RITE_KUKULU, branch, head };
  const begun = await ports.row("rite-begin", { rite: RITE_KUKULU, branch, head });
  if (!begun.ok) {
    ports.say(`kūkulu: the rite begins nothing: ${begun.message}`);
    return { code: 1, data: { ...base, begun: false, refusal: begun.code } };
  }
  // ONE RITE PER LENT FACE: each face's tessera lands under that face, and a face with no lei of its own waits by name.
  const begunFaces = (Array.isArray(begun.output["faces"]) ? begun.output["faces"] as Array<Record<string, unknown>> : [])
    .map((f) => ({ face: String(f["face"]), ordinal: Number(f["ordinal"]), tessera: String(f["tessera"]) }));
  const waits = Array.isArray(begun.output["waits"]) ? (begun.output["waits"] as unknown[]).map(String) : [];
  const tesserae = begunFaces.map((f) => ({ face: f.face, tessera: f.tessera }));
  const spent: Record<string, unknown> = { tesserae, ...(waits.length > 0 ? { waits } : {}) };
  ports.say(`kūkulu: begun; each lent face's lei returned and its guest half rests (${begunFaces.map((f) => `${f.face} tessera ${f.tessera}`).join(", ")})`);
  for (const face of waits) ports.say(`kūkulu: ${face} carries no kukulu lei on this line and waits; the other faces' rite goes on`);
  // THE SEED THE IMAGE OFFERS, said before the build; it reads and moves nothing.
  let seed: { cid: string; ratchets: string } | null = null;
  if (ports.seedOffer) {
    const offer = await ports.seedOffer(head);
    if (offer === null) ports.say("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    else {
      ports.say(kukuluSeedLine(head, offer));
      seed = { cid: offer.seed.cid, ratchets: ratchetWords(compareGenesisDigests(offer.record, offer.seed.digests)) };
      spent["seed"] = seed;
    }
  }
  const landCall = begunFaces.map((f) => `lares rite land --tessera ${f.tessera} --head ${head} --face ${f.ordinal}`).join("; ");
  for (const verb of ["build", "down", "up"] as const) {
    const code = await ports.shim(verb);
    if (code !== 0) {
      const where = verb === "build" ? "the vessel still stands as it stood" : verb === "down" ? "the vessel may still stand" : "the vessel stands down";
      ports.say(`kūkulu: the shim's ${verb} answered ${code}; ${where}; the lei's return stays spent, and the begun half reads red at the next wake until a vessel at ${head} lands it (${landCall}).`);
      return { code: 1, data: { ...base, ...spent, begun: true, landed: false, stopped: verb } };
    }
    if (verb !== "build" || !ports.image) continue;
    // BETWEEN THE BUILD AND THE LOWERING, the standing vessel writes what the next one carries to the pūlama. The host names
    // the image. A vessel that cannot write the offer stays standing: the vessel raised after it would wear nothing.
    const image = await ports.image();
    if (image === null) {
      ports.say("kūkulu: the host names no digest for the image it built, so no offer rests for a pūlama; the rite goes on, and a vessel standing by a pūlama will wake at the floor.");
      continue;
    }
    const offered = await ports.row("rite-offer", { branch, head, image });
    if (!offered.ok) {
      ports.say(`kūkulu: the standing vessel wrote no offer (${offered.message}); it still stands, the lei's return stays spent, and the begun half reads red until a vessel at ${head} lands it (${landCall}).`);
      return { code: 1, data: { ...base, ...spent, begun: true, landed: false, stopped: "offer", refusal: offered.code } };
    }
    const names = (key: string): string[] => (Array.isArray(offered.output[key]) ? (offered.output[key] as unknown[]).map(String) : []);
    const faces = names("faces"), waits = names("waits");
    ports.say(`kūkulu: the offer rests for the next vessel (${String(offered.output["lei"] ?? "?")} lei, a vouch for each of ${faces.length > 0 ? faces.join(", ") : "the lent faces"} over ${image})`);
    for (const face of waits) ports.say(`kūkulu: ${face} carries no lei on this line and waits at the pūlama by name; the other faces' lend stands`);
  }
  let par = true;
  for (const f of begunFaces) {
    const landed = await ports.row("rite-land", { tessera: f.tessera, head, face: f.ordinal });
    if (landed.ok) { par = landed.output["par"] === true && par; continue; }
    if (landed.code === "vessel-locked") {
      ports.say(`kūkulu: the new vessel stands locked, so the host halves wait. Open it with \`lares vault unlock\`, then land the rite: ${landCall}`);
      return { code: 0, data: { ...base, ...spent, begun: true, landed: false, awaits: "unlock" } };
    }
    ports.say(`kūkulu: the landing of ${f.face} refused: ${landed.message}`);
    return { code: 1, data: { ...base, ...spent, begun: true, landed: false, refusal: landed.code } };
  }
  ports.say(par ? "kūkulu: landed; conferre reads every face's tessera par" : "kūkulu: landed at another head than the rite began at; conferre reads a tessera red");
  return { code: par ? 0 : 1, data: { ...base, ...spent, begun: true, landed: true, par } };
}
