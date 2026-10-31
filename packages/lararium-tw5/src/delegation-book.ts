/**
 * delegation-book — the daemon island's pending asks to main, one resolver per request id until main answers.
 *
 * `route` posts a `daemon:delegate-verb` and holds its resolver; `answer` settles it from main's `daemon:verb-result`.
 * An ask the caller gave up on (its AbortSignal aborts) drops its entry and rejects, so a mount main never answers
 * leaves nothing standing for the island's life.
 */
import { mkDaemonDelegateVerb, type Verb } from "@lararium/mesh";

type Post = (msg: ReturnType<typeof mkDaemonDelegateVerb>) => void;

export interface DelegationBook {
  /** Post the verb to main and wait for its answer; an abort of `signal` drops the entry and rejects. */
  route(invocation: Verb, signal?: AbortSignal): Promise<Record<string, unknown>>;
  /** Settle the ask `requestId` from main's answer; false when no such ask stands (answered, abandoned or unknown). */
  answer(requestId: string, answer: { readonly error?: string; readonly result?: Record<string, unknown> }): boolean;
  /** How many asks stand unanswered. */
  size(): number;
}

export function makeDelegationBook(post: Post): DelegationBook {
  const pending = new Map<string, {
    resolve: (result: Record<string, unknown>) => void;
    reject:  (err: Error) => void;
  }>();
  return {
    route(invocation, signal) {
      return new Promise((resolve, reject) => {
        const id = invocation.requestId;
        if (signal?.aborted) { reject(new Error(`delegation abandoned before it posted: ${invocation.action}`)); return; }
        pending.set(id, { resolve, reject });
        signal?.addEventListener("abort", () => {
          if (pending.delete(id)) reject(new Error(`delegation abandoned: ${invocation.action} (${id})`));
        }, { once: true });
        try { post(mkDaemonDelegateVerb({
          requestId:   id,
          verb:        invocation.action,
          args:        invocation.args as Record<string, unknown>,
          requestedBy: invocation.requestedBy,
          ...(invocation.targets?.length ? { targets: [...invocation.targets] } : {}),
          ...(invocation.batchMode       ? { batchMode: String(invocation.batchMode) } : {}),
        })); } catch (error) { pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))); }   // a post that throws leaves no entry
      });
    },
    answer(requestId, answer) {
      const entry = pending.get(requestId);
      if (!entry) return false;
      pending.delete(requestId);
      if (answer.error) entry.reject(new Error(answer.error));
      else              entry.resolve(answer.result ?? {});
      return true;
    },
    size: () => pending.size,
  };
}
