/** Shutdown orders ownership boundaries; a failed boundary never skips later cleanup. */
export type ShutdownPhase = "producers" | "flush" | "signers" | "islands" | "resources" | "repo";
export interface ShutdownEntry {
  readonly what: string;
  readonly phase?: ShutdownPhase;
  readonly down: () => void | Promise<void>;
}

export class CompositionShutdownError extends AggregateError {
  constructor(errors: unknown[], readonly storeClosed: boolean) {
    super(errors, `composition shutdown failed: ${errors.map((e) => e instanceof Error ? e.message : String(e)).join("; ")}`);
  }
}

/** Flush failures retain their evidence even when the Repo closes successfully. */
export async function closeCompositionRepo(owner: {
  flush(): Promise<void>;
  seal(): Promise<void>;
  endHydration(): void;
  shutdown(): Promise<void>;
}): Promise<void> {
  const errors: unknown[] = [];
  let closed = false;
  try {
    try { await owner.flush(); } catch (e) { errors.push(e); }
    try { await owner.seal(); } catch (e) { errors.push(e); }
  } finally {
    try { owner.endHydration(); } catch (e) { errors.push(e); }
    try { await owner.shutdown(); closed = true; } catch (e) { errors.push(e); }
  }
  if (errors.length > 0) throw new CompositionShutdownError(errors, closed);
}

export async function shutdownComposition(entries: ShutdownEntry[], release?: () => Promise<void>): Promise<void> {
  const pending = entries.splice(0).reverse();
  const errors: unknown[] = [];
  let storeClosed = !pending.some((e) => e.phase === "repo");
  const down = async (entry: ShutdownEntry): Promise<void> => {
    try {
      await entry.down();
      if (entry.phase === "repo") storeClosed = true;
    } catch (e) {
      if (entry.phase === "repo") storeClosed = e instanceof CompositionShutdownError && e.storeClosed;
      errors.push(e);
      console.error(`[lararium] teardown: ${entry.what} — ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  for (const phase of ["producers", "flush", "signers", "islands", "resources", "repo"] as const) {
    const group = pending.filter((e) => (e.phase ?? "resources") === phase);
    if (phase === "islands") await Promise.all(group.map(down));
    else for (const entry of group) await down(entry);
  }
  if (storeClosed && release) {
    try { await release(); } catch (e) { errors.push(e); }
  }
  if (errors.length > 0) throw new CompositionShutdownError(errors, storeClosed);
}

/** The mint's owner revokes its signer and closes its table entry, including after an overtaking stop. */
export function ownDialPresentation(presentation: {
  readonly signer: { readonly binding: { readonly sessionId: string }; drop(): void };
} | null | undefined, table: { close(sessionId: string): unknown }): () => void {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (!presentation) return;
    try { presentation.signer.drop(); }
    finally { table.close(presentation.signer.binding.sessionId); }
  };
}

/** An island's own shutdown budget ended without its acknowledgement. */
export class IslandShutdownCut extends Error {}

/** An I/O or ownership failure takes precedence over a completed stop that cut an island. */
export function shutdownExitCode(error: unknown): 1 | 76 {
  const onlyCuts = (e: unknown): boolean => e instanceof IslandShutdownCut
    || (e instanceof AggregateError && e.errors.length > 0 && e.errors.every(onlyCuts));
  return error instanceof CompositionShutdownError && error.storeClosed && onlyCuts(error) ? 76 : 1;
}

/** Refused construction preserves both its cause and the teardown's ownership evidence. */
export async function closeRefusedComposition(failure: unknown, teardown: () => Promise<void>): Promise<never> {
  try { await teardown(); }
  catch (e) {
    throw new CompositionShutdownError([failure, ...(e instanceof CompositionShutdownError ? e.errors : [e])],
      e instanceof CompositionShutdownError && e.storeClosed);
  }
  throw failure;
}
