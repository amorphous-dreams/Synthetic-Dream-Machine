import { ArchiveIdentityMismatch, KeyhiveProvider } from "./keyhive-provider.js";
import { InMemoryEventStore } from "./event-store.js";

/** Whether an Archive belongs to this seed's Individual: a throwaway provider stands from the seed over the Archive and refuses by name when it names another identity. */
export async function archiveIsOf(seed: Uint8Array, archiveBytes: Uint8Array): Promise<boolean> {
  const provider = new KeyhiveProvider();
  try {
    await provider.init({ seed, eventStore: new InMemoryEventStore(), archiveBytes });
    return true;
  } catch (cause) {
    if (cause instanceof ArchiveIdentityMismatch) return false;
    throw cause;
  } finally {
    await provider.dispose().catch(() => undefined);
  }
}
