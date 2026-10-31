import type { Repo } from "@automerge/automerge-repo";
import { faceRecordsOf } from "@lararium/mesh";
import { admitAgentEntry, type FaceIntentAdmissionPorts } from "@lararium/keyhive";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { loadIntentFace } from "./commands/intent.js";
import { intentRelayRing, intentRelayStands } from "./intent-relay-ring.js";
import { intentRelayPublicKey, signAsIntentRelay } from "./intent-relay-key-store.js";
import { CustodyLocked } from "./custody-holder.js";
import type { IntentRelayFace } from "./intent-relay.js";

export async function resolveIntentRelayFace(group: string, ports: { repo: Repo; catalogUrl: string }): Promise<IntentRelayFace | null> {
  const indexes = await listAnchoredPersonas();
  let held = false;
  for (const index of indexes) {
    try { if ((await loadIdentityAnchors(index))?.personaGroupId === group) { held = true; break; } }
    catch (error) { if (error instanceof CustodyLocked) throw error; }
  }
  if (!held) return null;
  const ring = intentRelayRing();
  return { group, admit: async (entry) => {
    try {
      const refresh = async (): Promise<FaceIntentAdmissionPorts> => {
        const loaded = await loadIntentFace(ports.repo, ports.catalogUrl, { group });
        return { group, plane: loaded.plane, personaRecords: () => faceRecordsOf([loaded.personaPlane?.doc()], group), kelChain: loaded.kelChain, anchor: loaded.anchor, standing: loaded.standing, verbs: loaded.verbs, heldFrontiers: () => loaded.heldFrontiers, relayAdmits: () => ring.admits(group), relayStands: () => intentRelayStands(group), refresh };
      };
      const result = await admitAgentEntry(await refresh(), entry, { key: await intentRelayPublicKey(), sign: signAsIntentRelay });
      if (result.status !== "refused" && result.status !== "fault") {
        try { await ports.repo.flush(); } catch { return { status: "fault" }; }
      }
      return result;
    } catch { return { status: "refused", refusal: "fault" }; }
  } };
}
