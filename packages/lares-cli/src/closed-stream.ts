/**
 * closed-stream — a write to a stream whose reader left ends the command with a named line, never a Node crash.
 *
 * Node raises an EPIPE from a write to a pipe whose reader closed as an 'error' event on that stream, and an 'error' event with
 * no listener becomes an uncaught exception: a keep run under the shim's tee crashed so (2026-11-28, `syscall: 'write'`). The
 * guard listens on the stdio streams. An EPIPE (or a write to a stream already destroyed) marks the stream closed, names it
 * ONCE on each other stream that still takes writes, and lets the command's own work finish, so no act tears mid-way; the exit
 * then reads `BROKEN_PIPE_EXIT`. Any other stream error throws as before.
 */

/** The broken-pipe exit: 128 + SIGPIPE (13), the code a shell reads for a writer whose reader left. */
export const BROKEN_PIPE_EXIT = 141;

/** A stream the guard watches: its 'error' events, whether it still takes writes, and its write. */
export interface WatchedStream {
  on(event: "error", listener: (err: NodeJS.ErrnoException) => void): unknown;
  readonly writable?: boolean;
  write(chunk: string): boolean;
}

export interface ClosedStreamGuard {
  /** The first stream whose reader left, by name; null while every reader stands. */
  readonly closed: () => string | null;
}

const CLOSED_CODES: ReadonlySet<string> = new Set(["EPIPE", "ERR_STREAM_DESTROYED"]);

export function guardClosedStreams(streams: ReadonlyArray<{ readonly name: string; readonly stream: WatchedStream }>): ClosedStreamGuard {
  let first: string | null = null;
  const gone = new Set<string>();
  for (const { name, stream } of streams) {
    stream.on("error", (err) => {
      if (!CLOSED_CODES.has(String(err?.code ?? ""))) throw err;
      if (gone.has(name)) return;
      gone.add(name);
      first ??= name;
      for (const other of streams) {
        if (gone.has(other.name) || other.stream.writable === false) continue;
        try { other.stream.write(`lares: ${name} closed under this command (its reader left: ${String(err.code)}); the work in flight finishes, its lines on ${name} go unread, and the exit reads ${BROKEN_PIPE_EXIT}\n`); }
        catch { /* that reader left too: nothing more to tell */ }
      }
    });
  }
  return { closed: () => first };
}

/** The exit a command leaves with: the broken-pipe exit where a reader left under it, else its own code. */
export const exitAfterStreams = (guard: ClosedStreamGuard, code: number): number => (guard.closed() === null ? code : BROKEN_PIPE_EXIT);
