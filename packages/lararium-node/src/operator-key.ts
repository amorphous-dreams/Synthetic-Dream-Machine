/**
 * Node operator identity — persists Ed25519 keypair as JSON on the filesystem.
 *
 * Stored at <dataDir>/operator-key.json. Created on first boot, reused thereafter.
 * Lost if the file is deleted (acceptable for local-operator mode; future: Keyhive backup).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  generateOperatorIdentity,
  deserializeIdentity,
  serializeIdentity,
  type LarOperatorIdentity,
  type LarOperatorIdentityJson,
} from "@lararium/core";

export async function getOrCreateNodeIdentity(dataDir: string): Promise<LarOperatorIdentity> {
  const keyFile = join(dataDir, "operator-key.json");
  if (existsSync(keyFile)) {
    const raw = JSON.parse(readFileSync(keyFile, "utf-8")) as LarOperatorIdentityJson;
    return deserializeIdentity(raw);
  }
  const identity = await generateOperatorIdentity();
  writeFileSync(keyFile, JSON.stringify(serializeIdentity(identity), null, 2), "utf-8");
  return identity;
}
