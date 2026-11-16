/**
 * rite-kukulu — the kūkulu rite's order: a vessel raised again around its hearth, with a tessera kept across the gap.
 *
 * The rite runs on the host, behind four ports, in one order:
 *
 *   1. checkout     the checkout's head and branch
 *   2. rite-begin   IN THE VESSEL: derive the head's tree, return the kukulu lei, rest the guest half (`rite-begun`)
 *   3. shim build   rebuild the vessel's image from the committed checkout
 *   3a. rite-offer  IN THE VESSEL, where the host names the image it built (`image`): gather the line's lei, sign the vouch
 *                   over that image, and rest the offer the new vessel carries to the pūlama (`kukulu-offer.json`)
 *   4. shim down    the standing vessel goes down
 *   5. shim up      a new vessel stands
 *   6. rite-land    IN THE NEW VESSEL: rest the host half (`rite-landed`), naming the begun half and the head it stands at
 *
 * THE RITE BEGINS BEFORE THE VESSEL GOES DOWN. A begin the vessel refuses (no lei, no evidence, no return left) runs no shim
 * verb at all. The return comes first by design, so a build that fails leaves the lei's return spent and the begun half
 * waiting: conferre reads it red at the next wake, and the vessel still stands.
 *
 * THE NEW VESSEL COMES BACK LOCKED until a holder keeps its hearth lit across the rebuild (the pūlama, road L47). A locked
 * vessel refuses the landing; the rite then ends clean, names the unlock and the landing still owed, and the wake reads the
 * begun half red until someone lands it.
 *
 * The host names the head it built from (the shim refuses a dirty checkout and stamps that head on the image), and the vessel
 * signs the landing under it.
 */

export type RiteRowAnswer =
  | { readonly ok: true; readonly output: Record<string, unknown> }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface RitePorts {
  /** The checkout's head and the branch it rides. */
  checkout(): Promise<{ readonly head: string; readonly branch: string }>;
  /** One store row, answered by the vessel that stands (or the offline door where none does). */
  row(verb: "rite-begin" | "rite-land" | "rite-offer", args: Record<string, unknown>): Promise<RiteRowAnswer>;
  /** The digest of the image the build left, as the HOST reads it; null where the host names none. Absent, the rite writes no offer. */
  image?(): Promise<string | null>;
  /** One verb of the host shim; the answer carries its exit code. */
  shim(verb: "build" | "down" | "up"): Promise<number>;
  say(line: string): void;
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
  const tessera = String(begun.output["tessera"]);
  ports.say(`kūkulu: begun; the lei returned and the guest half rests (tessera ${tessera})`);
  const landCall = `lares rite land --tessera ${tessera} --head ${head}`;
  for (const verb of ["build", "down", "up"] as const) {
    const code = await ports.shim(verb);
    if (code !== 0) {
      const where = verb === "build" ? "the vessel still stands as it stood" : verb === "down" ? "the vessel may still stand" : "the vessel stands down";
      ports.say(`kūkulu: the shim's ${verb} answered ${code}; ${where}; the lei's return stays spent, and the begun half reads red at the next wake until a vessel at ${head} lands it (${landCall}).`);
      return { code: 1, data: { ...base, tessera, begun: true, landed: false, stopped: verb } };
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
      return { code: 1, data: { ...base, tessera, begun: true, landed: false, stopped: "offer", refusal: offered.code } };
    }
    ports.say(`kūkulu: the offer rests for the next vessel (${String(offered.output["lei"] ?? "?")} lei, a vouch over ${image})`);
  }
  const landed = await ports.row("rite-land", { tessera, head });
  if (landed.ok) {
    const par = landed.output["par"] === true;
    ports.say(par ? "kūkulu: landed; conferre reads the tessera par" : "kūkulu: landed at another head than the rite began at; conferre reads the tessera red");
    return { code: par ? 0 : 1, data: { ...base, tessera, begun: true, landed: true, par } };
  }
  if (landed.code === "vessel-locked") {
    ports.say(`kūkulu: the new vessel stands locked, so the host half waits. Open it with \`lares vault unlock\`, then land the rite: ${landCall}`);
    return { code: 0, data: { ...base, tessera, begun: true, landed: false, awaits: "unlock" } };
  }
  ports.say(`kūkulu: the landing refused: ${landed.message}`);
  return { code: 1, data: { ...base, tessera, begun: true, landed: false, refusal: landed.code } };
}
