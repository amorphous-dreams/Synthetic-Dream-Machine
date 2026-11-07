#!/usr/bin/env node
import { watch, openSync, fstatSync, readFileSync, closeSync, constants as FS } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_RECEIPT_WAIT_MS = 300_000;
/** Wait only for this request's receipt; file events wake reads, never a polling loop. */
export async function waitForReceipt(file, { timeoutMs = 120_000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_RECEIPT_WAIT_MS) {
    throw new Error(`receipt-timeout-bound: choose 1..${MAX_RECEIPT_WAIT_MS} milliseconds`);
  }
  if (!/^res-\d+\.json$/.test(path.basename(file))) throw new Error('receipt-name: expected res-<id>.json');
  return new Promise((resolve, reject) => {
    let watcher, timer, done = false;
    const finish = (error, answer) => {
      if (done) return;
      done = true; watcher?.close(); clearTimeout(timer);
      if (error) reject(error); else resolve(answer);
    };
    const read = () => {
      let fd;
      try {
        fd = openSync(file, FS.O_RDONLY | FS.O_NOFOLLOW | FS.O_NONBLOCK);
        if (!fstatSync(fd).isFile()) throw new Error('receipt-file: not a regular file');
        finish(null, JSON.parse(readFileSync(fd, 'utf8')));
      } catch (error) {
        // Creation can precede the broker's write. A change event completes that read.
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) finish(error);
      } finally { if (fd !== undefined) closeSync(fd); }
    };
    try {
      watcher = watch(path.dirname(file), (_event, name) => {
        if (name === null || String(name) === path.basename(file)) read();
      });
      watcher.on('error', error => finish(error));
      // LIVENESS: a broker that died releases the lead by this enforced, capped deadline.
      timer = setTimeout(() => finish(new Error(`receipt-timeout: ${path.basename(file)} absent or incomplete after ${timeoutMs}ms; broker may have died`)), timeoutMs);
      read(); // Watch first, then read: an answer arriving during setup cannot get lost.
    } catch (error) { finish(error); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length < 3 || process.argv.length > 4) throw new Error('usage: wait-receipt.mjs <res-id.json> [timeout-ms]');
    const answer = await waitForReceipt(process.argv[2], process.argv[3] ? { timeoutMs: Number(process.argv[3]) } : {});
    console.log(JSON.stringify(answer));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
