/** Operator acts over the vessel's relay enablement and admission key. */
import { deriveGateBundle, gateKnock, sovereignGateRoot, sovereignRoute, utf8Bytes, INTENT_RELAY_ROUTE, type GateBundlePin } from "@lararium/mesh";
import { listAnchoredPersonas, loadIdentityAnchors } from "../identity-anchors.js";
import { resolveIntentFaceIndex, IntentRefused } from "./intent.js";
import { custodyGateDoor, unlockedFaceOrdinals } from "../custody-seat.js";
import { enableIntentRelayFace, disableIntentRelayFace, enabledIntentRelayFaces } from "../intent-relay-ring.js";
import { heldIntentRelayKey, intentRelayKeyOrMint, intentRelayPublicKey, rotateIntentRelayKey } from "../intent-relay-key-store.js";

export type IntentRelayAction = "enable" | "disable" | "status" | "rotate";

/** `standing` reads the running service's stood pin for a group; absent (a command run outside a standing vessel), status derives the address an enabled face WOULD answer on and says `standing: null`. */
export async function runIntentRelayCommand(opts: { action: IntentRelayAction; face?: number; standing?: (group: string) => GateBundlePin | null }): Promise<Record<string, unknown>> {
  if (opts.action === "rotate") return { ...await rotateIntentRelayKey() };
  const index = resolveIntentFaceIndex(opts.face, await listAnchoredPersonas(), await unlockedFaceOrdinals());
  const anchor = await loadIdentityAnchors(index);
  if (!anchor) throw new IntentRefused(`face-not-held: h${index}`);
  const group = anchor.personaGroupId;
  if (opts.action === "enable") {
    await intentRelayKeyOrMint();
    await enableIntentRelayFace(group);
  } else if (opts.action === "disable") await disableIntentRelayFace(group);
  const enabled = (await enabledIntentRelayFaces()).includes(group);
  let path: string | null = null;
  let pin: GateBundlePin | null = null;
  if (enabled && opts.standing) {
    pin = opts.standing(group);
    if (pin) path = `${pin.route}/${gateKnock(pin)}`;
  } else if (enabled) {
    const bundle = deriveGateBundle(sovereignGateRoot(custodyGateDoor()), utf8Bytes(group), sovereignRoute(INTENT_RELAY_ROUTE));
    try { pin = bundle.pin; path = `${pin.route}/${gateKnock(pin)}`; }
    finally { bundle.drop(); }
  }
  return { face: index, enabled, standing: opts.standing ? pin !== null : null, path, pin, key: heldIntentRelayKey() ? await intentRelayPublicKey() : null };
}
