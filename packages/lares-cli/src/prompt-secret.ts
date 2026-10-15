// @heleuma:exempt — thin TTY input helper beneath the anchored command grammar. Owns no semantic
// boundary; it only reads a secret from the operator without echoing it.

/**
 * prompt-secret — read a passphrase from a TTY WITHOUT echoing it (the no-echo companion to render.ts).
 *
 * The vault gestures (seal/rotate/export) need a passphrase, and a passphrase MUST NOT land in the shell
 * history, the process argv, or the terminal scrollback. So the interactive path reads it here with the
 * TTY in raw, echo-off mode; the non-interactive path (agents, CI) carries it via an environment variable
 * instead (never a flag). The bytes live only for the call that consumes them — this returns a string the
 * caller passes straight to the daemon verb (or the direct core op) and then drops.
 *
 * A double-entry confirm guards a NEW passphrase (a typo would seal the archive under a passphrase the
 * operator can never reproduce — a self-inflicted lockout).
 */

import { stdin, stdout } from "node:process";

/** True when we can run an interactive no-echo prompt (a real TTY on both ends). */
export function canPromptSecret(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

/** Read one line from the TTY with echo suppressed. Rejects when stdin is not a TTY. */
export function promptSecret(label: string, stream: TtyStream = stdin): Promise<string> {
  return readTty(label, false, stream);
}

/** Read one VISIBLE line from the TTY (a choice, never a secret). Rejects when stdin is not a TTY. */
export function promptLine(label: string, stream: TtyStream = stdin): Promise<string> {
  return readTty(label, true, stream);
}

/** The slice of a TTY stream a prompt drives; defaults to the process's stdin. */
export type TtyStream = Pick<
  NodeJS.ReadStream,
  "isTTY" | "isRaw" | "setRawMode" | "resume" | "pause" | "setEncoding" | "on" | "removeListener" | "unshift"
>;

/** Streams whose last read ended on a bare carriage return, so a line feed leading the next chunk is that CRLF's second byte. */
const crEnded = new WeakSet<object>();

function readTty(label: string, echo: boolean, stdin: TtyStream): Promise<string> {
  if (!stdin.isTTY) return Promise.reject(new Error("promptSecret: stdin is not a TTY"));
  return new Promise<string>((resolve, reject) => {
    stdout.write(label);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const done = (rest: string, fn: () => void) => {
      stdin.setRawMode(wasRaw);
      stdin.removeListener("data", onData);
      // what followed the line end belongs to the next read: it goes back to the stream, not to the floor.
      if (rest.length > 0) stdin.unshift(rest);
      stdin.pause();
      stdout.write("\n");
      fn();
    };
    const onData = (chunk: string) => {
      // the line feed of a CRLF whose carriage return ended the previous read is the same line end.
      let text = chunk;
      if (crEnded.delete(stdin) && text.startsWith("\n")) text = text.slice(1);
      for (let i = 0; i < text.length; i++) {
        const c = text[i]!;
        if (c === "\r" || c === "\n") {
          let rest = text.slice(i + 1);
          if (c === "\r") {
            if (rest.startsWith("\n")) rest = rest.slice(1);
            else if (rest.length === 0) crEnded.add(stdin);
          }
          done(rest, () => resolve(buf));
          return;
        }
        if (c === "\u0003") { done("", () => reject(new Error("aborted"))); return; }   // Ctrl-C
        if (c === "\u007f" || c === "\b") { buf = buf.slice(0, -1); continue; }          // backspace
        buf += c;
        if (echo) stdout.write(c);
      }
    };
    stdin.on("data", onData);
  });
}

/**
 * Read a NEW passphrase twice and confirm the two match — the anti-lockout guard. Re-prompts on a
 * mismatch (up to `tries`), then rejects. Empty is refused (the core would refuse anyway; catch it here
 * with a friendly message).
 */
export async function promptSecretConfirmed(label: string, tries = 3): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const a = await promptSecret(`${label}: `);
    if (a.length === 0) { stdout.write("  (empty — try again)\n"); continue; }
    const b = await promptSecret(`${label} (confirm): `);
    if (a === b) return a;
    stdout.write("  (entries did not match — try again)\n");
  }
  throw new Error("passphrase confirmation failed after multiple attempts");
}
