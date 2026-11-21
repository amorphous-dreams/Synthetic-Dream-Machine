import { ArchiveIdentityMismatch, KeyhiveProvider } from "./keyhive-provider.js";
import { InMemoryEventStore } from "./event-store.js";

/**
 * Refuse an Archive that belongs to another identity than this seed's Individual: a throwaway provider stands from the seed over
 * the Archive, and a restore naming another identity throws `ArchiveIdentityMismatch` (its `restored` names the would-be writer).
 * An Archive that does not decode throws its own fault. Either way nothing stands, so a caller that seals only after this
 * resolves seals nothing on a refusal.
 */
export async function requireArchiveOf(seed: Uint8Array, archiveBytes: Uint8Array): Promise<void> {
  const provider = new KeyhiveProvider();
  try {
    await provider.init({ seed, eventStore: new InMemoryEventStore(), archiveBytes });
  } finally {
    await provider.dispose().catch(() => undefined);
  }
}

/** Whether an Archive belongs to this seed's Individual: a throwaway provider stands from the seed over the Archive and refuses by name when it names another identity. */
export async function archiveIsOf(seed: Uint8Array, archiveBytes: Uint8Array): Promise<boolean> {
  try {
    await requireArchiveOf(seed, archiveBytes);
    return true;
  } catch (cause) {
    if (cause instanceof ArchiveIdentityMismatch) return false;
    throw cause;
  }
}
