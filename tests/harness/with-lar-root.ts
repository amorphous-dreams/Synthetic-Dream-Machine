/**
 * with-lar-root — the ONE sanctioned in-process vessel-identity isolation pattern.
 *
 * `node-vessel-identity.ts`'s `identityDir()` resolves off `LAR_ROOT`/XDG env vars ALONE
 * (`larIdentityDir`) and takes no caller-supplied path: an isolating caller that instead scoped a
 * `dataDir` per simulated vessel, in-process, with no matching `LAR_ROOT` mutation, would silently
 * read/write the REAL `~/.local/share/lares/identity` home rather than its intended isolated one —
 * the exact footgun `persona-ring-cross-operator-admit.test.ts` measured live.
 *
 * A test process carries no `LAR_ROOT` of its own, so an in-process multi-vessel fixture (two or
 * more simulated vessels sharing one node process, e.g. `two-vessel-mesh.test.ts`,
 * `persona-ring-cross-operator-admit.test.ts`) MUST wrap every vessel-identity read/write in this —
 * mutate `LAR_ROOT` for the duration of one vessel's identity call, then restore it. This is the
 * ONE place that pattern lives; a caller that reinvents it independently instead grows a
 * second copy that drifts.
 *
 * NOT thread-safe against CONCURRENT vessels in the same process — `LAR_ROOT` is process-global
 * state, so two `withLarRoot` calls racing each other (rather than nesting/sequencing) would
 * stomp one another. Every existing caller `await`s each call before starting the next; a caller
 * that parallelizes vessel-identity reads needs a different isolation mechanism (real subprocesses,
 * as `tests/harness/vessel-key.ts` uses for exactly this reason).
 */
export async function withLarRoot<T>(root: string, work: () => Promise<T>): Promise<T> {
  const previous = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  try {
    return await work();
  } finally {
    if (previous === undefined) delete process.env["LAR_ROOT"];
    else process.env["LAR_ROOT"] = previous;
  }
}
