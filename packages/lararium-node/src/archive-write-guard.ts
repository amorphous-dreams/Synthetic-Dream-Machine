/**
 * archive-write-guard — ONE GUARD FOR EVERY SEALED CARRIER: a write lands over a sealed carrier only under
 * a key that OPENS it.
 *
 * A vessel at the WAKING FLOOR boots without its archive and the M3 floor still exports the keyhive it
 * booted — a fresh, empty identity. Landing that over the sealed bytes replaces the sovereign identity with
 * nothing. The floor wears THREE shapes and all of them reach a carrier writer:
 *
 *   · NO key (`key-absent`)   — the write lands CLEARTEXT over ciphertext, and every later boot reads the
 *                               carrier as unsealed;
 *   · a WRONG key (`key-wrong`) — the write SEALS, so no cleartext test catches it, and the sovereign bytes
 *                               come back readable only under a passphrase that never sealed them.
 *                               Measured: `vault rotate` old→new, then one stand under the OLD passphrase.
 *   · a carrier THIS VESSEL CANNOT FRAME — an envelope version it does not know, or a damaged header over
 *                               intact ciphertext. No key can be judged against those bytes, so none may be
 *                               blamed for them and none may overwrite them: a header repair could still
 *                               have recovered the ciphertext a write destroys.
 *
 * ONE INVARIANT covers all three: the current key must OPEN what stands on disk before anything replaces it.
 * The seal governs the WRITE as well as the read, so a mistyped passphrase destroys nothing.
 *
 * WHY THIS MODULE AND NOT A HELPER INSIDE ONE WRITER. `archive-passphrase` names FOUR sealed carriers and
 * states the rule that names the set — "every file a boot opens through `openArchiveBytes` under the
 * resolved seal policy rides this lifecycle". The guard first landed inside `identity-anchors`, covering
 * TWO of them, and the two share-stores wrote unguarded while the vault's rotate/repair lifecycle believed
 * they were covered. A guard that lives beside ONE writer is a guard the next writer forgets, so it lives
 * here and every carrier writer calls it.
 *
 * WHAT IT DOES NOT GOVERN. The deliberate policy-movers — `vault seal`, `rotate`, `repair` — stage their own
 * atomic writes in `archive-passphrase.ts`, each having PRE-VALIDATED every unseal under the current key
 * before a single temp is written. There the GCM tag already proves operator intent; a second guard in front
 * of a working pre-validation would only duplicate it. `vault export` carries its own distinct refusal (a
 * destination that resolves onto a carrier), because an export proves intent about a BACKUP, never about the
 * carrier it was aimed at.
 *
 * THE GUARD PROVES THE KEY, NEVER THE CONTENT. An opening key still admits an empty archive over a full one;
 * the boot closes that separately (`prepareNodeBoot` gates `archiveBytes` on the same `archiveOpens()`
 * reading, so a key that opens also HYDRATES keyhive and the export is no longer empty). Two independent
 * facts holding one invariant — they stay two.
 *
 * The write throws (a carrier writer's caller warns and carries on) and the sealed bytes stand.
 */

import { existsSync, readFileSync } from "node:fs";
import { readSealCarrier } from "@lararium/mesh";
import { probeArchiveBytes, ARCHIVE_PASSPHRASE_ENV, type SealPolicy } from "./archive-seal.js";

/**
 * Refuse a write over `path` unless the resolved policy OPENS the bytes standing there. A path with nothing
 * standing returns silently — the guard never blocks a founding.
 *
 * THE REFUSAL NAMES WHICH FACT IT MET, because folding them inverts the pin-reader law: a torn carrier
 * reported as a credential error sends an operator to re-type a passphrase that was right all along, while
 * the corruption sits unnamed. The three-valued distinction is NOT re-derived here — it rides
 * `probeArchiveBytes`, the same atom `readArchiveOpening` reads its five answers from.
 */
export function refuseWriteOverUnopenableSeal(path: string, policy: SealPolicy): void {
  if (!existsSync(path)) return;
  let stored: Uint8Array;
  try { stored = readFileSync(path); } catch { return; }

  const reading = readSealCarrier(stored);
  if (reading === "bare") return;          // no seal frames in these bytes — a cleartext carrier answers to any policy
  if (reading === "unopenable") {
    throw new Error(
      `archive-seal: refusing to write over the sealed carrier at ${path} — it carries a seal this vessel ` +
      `cannot decode (an unknown envelope version, or a damaged header over intact ciphertext). No ` +
      `passphrase can be judged against these bytes, and a write here would destroy ciphertext a header ` +
      `repair could still recover — copy the carrier aside before anything replaces it`,
    );
  }

  if (policy.mode === "cleartext") {
    throw new Error(
      `archive-seal: refusing to write a cleartext archive over the sealed one at ${path} — ` +
      `set ${ARCHIVE_PASSPHRASE_ENV} to the passphrase that sealed it`,
    );
  }

  // A key rides the policy — try it against the bytes it would replace. Only an OPEN earns the write.
  switch (probeArchiveBytes(stored, policy)) {
    case "opens":
      return;
    case "unreadable":
      // NAMED APART FROM A WRONG KEY on purpose: these bytes never framed, so the passphrase was never
      // tested and must not be blamed. The route out is a backup, not a re-type.
      throw new Error(
        `archive-seal: refusing to write over the sealed carrier at ${path} — the carrier is TORN (it will ` +
        `not decode as a sealed envelope), so no passphrase can open it and none is at fault here — ` +
        `recover it from a backup (\`lares vault export\` copy, or \`lares vault repair\`) rather than ` +
        `re-typing a credential`,
      );
    case "key-fails":
      throw new Error(
        `archive-seal: refusing to write over the sealed archive at ${path} — the configured ` +
        `${ARCHIVE_PASSPHRASE_ENV} does not open it, so this write would replace the sovereign ` +
        `identity under a passphrase that never sealed it`,
      );
  }
}
