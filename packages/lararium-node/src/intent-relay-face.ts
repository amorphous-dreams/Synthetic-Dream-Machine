/** Resolve only PersonaGroups this vessel's floor index names. */
import { readFaceIndexSync } from "./face-index.js";
import { larIdentityDir } from "./vessel-paths.js";
import type { IntentRelayFace } from "./intent-relay.js";

export async function resolveIntentRelayFace(group: string): Promise<IntentRelayFace | null> {
  const held = readFaceIndexSync(larIdentityDir()).faces.some((face) => "group" in face && face.group === group);
  return held ? { group, admit: async () => ({ status: "refused", refusal: "fault" }) } : null;
}
