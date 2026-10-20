/** Name a PersonaGroup's local sealed rows without exposing its group id in a filename. */
import { createHash } from "node:crypto";

export function personaGroupDigest(group: string): string {
  if (!group) throw new Error("row names no PersonaGroup");
  return createHash("sha256").update(group).digest("hex");
}
