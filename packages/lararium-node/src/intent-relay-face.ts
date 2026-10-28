import type { Repo } from "@automerge/automerge-repo";
import { faceRecordsOf } from "@lararium/mesh";
import { admitAgentEntry } from "@lararium/keyhive";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { loadIntentFace } from "./commands/intent.js";
import { intentRelayPublicKey, signAsIntentRelay } from "./intent-relay-key-store.js";
import type { IntentRelayFace } from "./intent-relay.js";

export async function resolveIntentRelayFace(group: string, ports: { repo: Repo; catalogUrl: string }): Promise<IntentRelayFace | null> {
  const indexes = await listAnchoredPersonas();
  let held = false;
  for (const index of indexes) if ((await loadIdentityAnchors(index))?.personaGroupId === group) { held = true; break; }
  if (!held) return null;
  return { group, admit: async (entry) => {
    try {
      const loaded = await loadIntentFace(ports.repo, ports.catalogUrl, { group });
      const result = await admitAgentEntry({ group, plane: loaded.plane, personaRecords: () => faceRecordsOf([loaded.personaPlane?.doc()], group), kelChain: [], verifiedFace: loaded.face, anchor: loaded.anchor, standing: loaded.standing, verbs: loaded.verbs, heldFrontiers: () => loaded.heldFrontiers }, entry, { key: await intentRelayPublicKey(), sign: signAsIntentRelay });
      if (result.status !== "refused") await ports.repo.flush();
      return result;
    } catch { return { status: "refused", refusal: "fault" }; }
  } };
}
