/**
 * with-lar-root — the ONE sanctioned in-process vessel-identity isolation pattern.
 *
 * `node-vessel-identity.ts`'s `identityDir()` resolves off `LAR_ROOT`/XDG env vars ALONE
 * (`larIdentityDir`) — it never did, and now cannot, take a caller-supplied path: a `dataDir`
 * parameter used to exist there and be silently ignored, which is the exact footgun a prior spirit
 * measured live (`persona-ring-cross-operator-admit.test.ts`): a caller isolating a `dataDir` per
 * simulated vessel, in-process, with no matching `LAR_ROOT` mutation, silently read/wrote the REAL
 * `~/.local/share/lares/identity` home instead of its intended isolated one.
 *
 * A test process carries no `LAR_ROOT` of its own, so an in-process multi-vessel fixture (two or
 * more simulated vessels sharing one node process, e.g. `two-vessel-mesh.test.ts`,
 * `persona-ring-cross-operator-admit.test.ts`) MUST wrap every vessel-identity read/write in this —
 * mutate `LAR_ROOT` for the duration of one vessel's identity call, then restore it. This was
 * previously reinvented near-identically in two separate e2e test files (a "second copy drifts"
 * duplication in its own right); it now lives in exactly one place.
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
