/** Found a realm board through the charter quorum's signed genesis door. */
import type { DocHandle } from "@automerge/automerge-repo";
import { charterHandLineage, type LarDoc } from "@lararium/mesh";
import type { SeatedCharter, StandingCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { prepareRealmFrontier, registerRealmFrontierInto } from "../src/realm-frontier-door.js";

export async function foundRealmFrontier(handle: DocHandle<LarDoc>, realm: string, charter: SeatedCharter | StandingCharter,
  hands?: readonly { readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }[]): Promise<void> {
  const lineage = charterHandLineage(charter.chain)?.lineage;
  if (!lineage) throw new Error("realm-frontier-fixture: charter lineage unreadable");
  const held = hands ?? ("signers" in charter ? await charter.signers() : []);
  const signers = held.map((s) => ({ key: s.signer, sign: s.sign }));
  const prepared = await prepareRealmFrontier({ realm, board: handle.doc(), lineage, counted: [], signers });
  handle.change((draft) => { registerRealmFrontierInto(draft, prepared); });
}
