/**
 * hearth-gate-pins — the vessel's pair index of gate pins, and the clock its dials draw deadlines from.
 *
 * A dial reaches only the gate it pinned (D1). The pins live in mesh's `hearthPinIndex`, keyed (hearth, Nexus, route,
 * tier); this vessel makes ONE index at boot and hands it to every dial, and no module holds a second.
 *
 * WHERE A PIN LANDS. The admit and the fleet-join answer carry the hearth's FULL sovereign sync pin (tier, Nexus, route, the
 * X25519 key that answers a flight and the Ed25519 key that signs the verdict), signed with the answer; a joinee keeps it in
 * its bootstrap (`hearth-dial-pin`), and each admit bundle it takes opens the pin its quorum signed. `chooseHearthDial` names
 * each under the hearth that issued it and `fileHearthPins` is the one door that files them, and the index refuses a pin that fails its read and a second, different pin under a key it holds.
 * TEMPORARY BRIDGE, NAMED: `hearthNameOf` calls a hearth by its sync URL's origin, because neither the answer nor the
 * bundle carries a true name for the hearth to file it under. The first signed carrier of one replaces the bridge.
 *
 * The node owns a clock, so `dialDeadlines` is here and not in mesh.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-gate-pins
 */
import {
  admitCarriageCommit, admitGatePinDigest, hearthPinIndex, readAdmitGatePinAt, readGateBundlePin,
  type GateBundlePin, type HearthPinIndex,
} from "@lararium/mesh";
import type { AdmitBundle } from "./admit-bundle.js";

/** The vessel's pair index: one per boot, empty until the admit repin seeds it. */
export function hearthGatePins(): HearthPinIndex {
  return hearthPinIndex();
}

/** TEMPORARY: the hearth's name as the pair index files it, off the sync URL it dials. */
export function hearthNameOf(syncUrl: string): string {
  try { return new URL(syncUrl).origin; } catch { return syncUrl.replace(/[\r\n]/g, ""); }
}

/** One pin to file, under the hearth that issued it. */
export interface HearthFiling {
  readonly hearth: string;
  readonly pin:    GateBundlePin;
}

/** The dial a vessel stands: the url, the pin chosen WITH it (null: idle), every pin to file, and what disagreed. */
export interface HearthDialChoice {
  readonly syncUrl: string | null;
  readonly pin:     GateBundlePin | null;
  readonly filings: readonly HearthFiling[];
  readonly notes:   readonly string[];
  /** Disagreements the boot should WARN of: the dial stood, on a choice another kept pin contradicts. */
  readonly warnings: readonly string[];
  /** WHERE THE DIAL'S PIN CAME FROM (road `P26`): the bootstrap's pin, a kept admit bundle's, or none. A kept bundle's pin
   *  seats the contracted class; the face's own hearth reads off the sealed landing record alone (`dial-relation`). */
  readonly source:   "bootstrap" | "kept" | null;
}

/**
 * Choose the hearth this vessel dials and the pin it dials with, as ONE pair.
 *
 * EACH PIN FILES UNDER THE HEARTH THAT ISSUED IT: the bootstrap's pin under its own sync url, each kept bundle's pin
 * under the bundle's own `syncUrl`. A kept bundle naming no sync url files nowhere (its hearth has no name here). A
 * kept bundle is RE-READ at seeding: its opening must answer the commitment its admit's quorum signed
 * (`admitCarriageCommit`), its pin must read at the bundle's own Nexus, and that pin must be signed by the bundle's
 * gate key. A bundle that fails any read files nothing and names why.
 *
 * THE URL, in rank: an explicit option, the bootstrap's sync url, the one url the vessel's verified kept bundles agree
 * on, the walk record's relay. THE PIN comes from the SAME hearth as the url: the bootstrap's pin when it names that
 * hearth, else the one distinct kept pin filed there. Two different pins at the dialed hearth choose none. A pin held
 * for another hearth is never dialed at this url, and the note says so. A kept pin at the dialed hearth that differs
 * from the bootstrap's pin leaves the bootstrap's pin the dial, and a WARNING names it (the index files the first).
 *
 * THE FLOOR PINS (house ruling "The admit's gate pin", carrier (b)): `keptFloor` reads the floor pins a signed fleet-join answer
 * carried for a Nexus (by its hex). Once a dial pin stands, the floor pins kept at ITS Nexus file under the dialed
 * hearth, each re-read at floor tier and that Nexus; none file without a dial pin.
 */
export function chooseHearthDial(opts: {
  readonly explicitUrl?: string | null;
  readonly hearthPin?:   { readonly syncUrl: string; readonly gatePin?: GateBundlePin } | null;
  readonly kept:         readonly AdmitBundle[];
  readonly walkRelay?:   string | null;
  readonly keptFloor?:   (nexusHex: string) => readonly GateBundlePin[];
}): HearthDialChoice {
  const notes: string[] = [];
  const warnings: string[] = [];
  const boot: HearthFiling | null = opts.hearthPin?.gatePin ? { hearth: hearthNameOf(opts.hearthPin.syncUrl), pin: opts.hearthPin.gatePin } : null;
  const kept: (HearthFiling & { readonly url: string })[] = [];
  for (const b of opts.kept) {
    const opening = b.opening;
    if (!opening) { notes.push(`kept bundle ${b.aid} carries no opening: no pin filed`); continue; }
    if (admitCarriageCommit(opening) !== b.admit.carriageCommit) { notes.push(`kept bundle ${b.aid} opening does not answer its admit's commitment: no pin filed`); continue; }
    const read = readAdmitGatePinAt(opening.carriage.gatePin, b.aid);
    if (!("pin" in read)) { notes.push(`kept bundle ${b.aid} pin refused at its own Nexus (${read.refusal}): no pin filed`); continue; }
    if (read.pin.signingKey !== b.gatePubKey.toLowerCase()) { notes.push(`kept bundle ${b.aid} pin is signed by another gate than its own: no pin filed`); continue; }
    if (!b.syncUrl) { notes.push(`kept bundle ${b.aid} names no sync url: its pin files under no hearth`); continue; }
    kept.push({ hearth: hearthNameOf(b.syncUrl), pin: read.pin, url: b.syncUrl });
  }
  const keptUrls = [...new Set(kept.map((k) => k.url))];
  if (keptUrls.length > 1) notes.push(`kept bundles name ${keptUrls.length} sync urls (${keptUrls.map(hearthNameOf).join(", ")}): none is the default`);
  const syncUrl = opts.explicitUrl ?? opts.hearthPin?.syncUrl ?? (keptUrls.length === 1 ? keptUrls[0]! : null) ?? opts.walkRelay ?? null;
  const filings: HearthFiling[] = [...(boot ? [boot] : []), ...kept.map(({ hearth, pin }) => ({ hearth, pin }))];
  if (syncUrl === null) return { syncUrl, pin: null, filings, notes, warnings, source: null };
  const at = hearthNameOf(syncUrl);
  let pin: GateBundlePin | null = null;
  let source: HearthDialChoice["source"] = null;
  if (boot !== null && boot.hearth === at) {
    pin = boot.pin;
    source = "bootstrap";
    const differing = kept.filter((k) => k.hearth === at && k.pin.nexus === boot.pin.nexus && admitGatePinDigest(k.pin) !== admitGatePinDigest(boot.pin));
    if (differing.length > 0) warnings.push(`the bootstrap's pin and ${differing.length} kept pin(s) for ${at} differ: the dial uses the bootstrap's pin; the index keeps it and refuses the kept one`);
  } else {
    const here = [...new Map(kept.filter((k) => k.hearth === at).map((k) => [admitGatePinDigest(k.pin), k.pin])).values()];
    if (here.length === 1) { pin = here[0]!; source = "kept"; }
    else if (here.length > 1) notes.push(`${here.length} different kept pins stand for ${at}: the dial chooses none`);
  }
  const elsewhere = [...new Set(filings.filter((f) => f.hearth !== at).map((f) => f.hearth))];
  if (elsewhere.length > 0) notes.push(`the dial goes to ${at}; pin(s) held for ${elsewhere.join(", ")} are filed there and not dialed here`);
  if (pin !== null && opts.keptFloor) {
    let floor: readonly GateBundlePin[] = [];
    try { floor = opts.keptFloor(pin.nexus); } catch { notes.push(`the kept floor pins for ${at} did not read: none filed`); }
    for (const raw of floor) {
      const read = readGateBundlePin(raw);
      if ("pin" in read && read.pin.tier === "floor" && read.pin.nexus === pin.nexus) filings.push({ hearth: at, pin: read.pin });
    }
  }
  return { syncUrl, pin, filings, notes, warnings, source };
}

/** File each pin under its own hearth. Returns how many the index took. */
export function fileHearthPins(index: HearthPinIndex, filings: readonly HearthFiling[]): number {
  let taken = 0;
  for (const f of filings) if (index.put(f.hearth, f.pin)) taken += 1;
  return taken;
}

/** A dial's deadline source over the node's timer: `lapse` runs once after `ms`, unless cancelled. */
export function dialDeadlines(ms = 15_000): { draw(lapse: () => void): { cancel(): void } } {
  return {
    draw(lapse) {
      const timer = setTimeout(lapse, ms);
      return { cancel: () => clearTimeout(timer) };
    },
  };
}
