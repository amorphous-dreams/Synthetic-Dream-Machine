/**
 * daemon-state-fixture — a founded daemon document as the founding leaves it: the state document minted beside the
 * vessel's secret home (one custody row names both) and named in the daemon document. Every fence read (a lease epoch, an
 * admission's price) reads there and refuses where nothing names one.
 */
import type { Repo } from "@automerge/automerge-repo";
import { nameVesselState } from "@lararium/mesh/vessel-state";
import { seedDaemonDoc } from "@lararium/mesh/social-seed";
import { standVesselSecretHome } from "../src/secret-home-store.js";

export async function seedFoundedDaemonDoc(repo: Repo): Promise<ReturnType<typeof seedDaemonDoc>> {
  const handle = seedDaemonDoc(repo);
  const home = await standVesselSecretHome(repo);
  nameVesselState(handle, home.stateUrl!);
  await repo.flush();
  return handle;
}
