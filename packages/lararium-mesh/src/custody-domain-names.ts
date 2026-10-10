/**
 * custody-domain-names — the custody domains the VK keyslots, the VK's tree check and the vessel KEL sign and derive under,
 * held outside the registry until the one DOMAINS commit declares them there.
 *
 * Each name resolves to exactly the address `mint("<name>")` builds in `domains.ts` (`DOMAIN_ROOT/<name>`, bare),
 * so moving a name into the registry moves no byte: every wrap and every inception signed under these strings
 * reads the same afterwards. The registry witness scans for domain LITERALS and these build from `DOMAIN_ROOT`,
 * so it does not see them here; the registry commit declares each through `mint`, points the importers of this
 * file at `domains.ts`, and deletes this file.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lar-uri
 */

import { DOMAIN_ROOT } from "./domains.js";

/** The vessel's own key-event log: the inception that commits the next floor key's digest. */
export const VESSEL_KEL_DOMAIN = `${DOMAIN_ROOT}/vessel-kel`;

/** The HKDF `info` every keyslot wrap derives under: a pin's KEK wrapping its share of the slot key, and the
 *  slot key wrapping the VK. */
export const VK_SLOT_WRAP_INFO = `${DOMAIN_ROOT}/vk-slot-wrap`;

/** The HKDF `info` of the slot tree's VK check: the keyed digest a tree carries so every writer proves the VK in
 *  hand against the standing tree before any byte moves. */
export const VK_CHECK_INFO = `${DOMAIN_ROOT}/vk-check`;
