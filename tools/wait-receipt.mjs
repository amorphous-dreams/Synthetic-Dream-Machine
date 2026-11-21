#!/usr/bin/env node
import { watch, openSync, fstatSync, readFileSync, closeSync, constants as FS } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RECEIPT_CAP_MS, RECEIPT_SILENCE_MS, isClaimName } from './relay-claim.mjs';

const bounded = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;

/**
 * Wait only for this request's receipt; file events wake reads, never a polling loop. Any claim's stir in the relay dir
 * reads as the broker's life and resets the silence bound; the cap holds whatever the claims do (relay-claim).
 */
export async function waitForReceipt(file, { silenceMs = RECEIPT_SILENCE_MS, capMs = RECEIPT_CAP_MS } = {}) {
  if (!bounded(silenceMs, RECEIPT_SILENCE_MS) || !bounded(capMs, RECEIPT_CAP_MS) || capMs < silenceMs) {
    throw new Error(`receipt-bound: silence 1..${RECEIPT_SILENCE_MS} ms, cap silence..${RECEIPT_CAP_MS} ms`);
  }
  if (!/^res-\d+\.json$/.test(path.basename(file))) throw new Error('receipt-name: expected res-<id>.json');
  return new Promise((resolve, reject) => {
    let watcher, silence, cap, done = false;
    const finish = (error, answer) => {
      if (done) return;
      done = true; watcher?.close(); clearTimeout(silence); clearTimeout(cap);
      if (error) reject(error); else resolve(answer);
    };
    // LIVENESS: a broker that died stirs no claim; the silence bound (a door's longest silence plus two relay pauses) releases the lead.
    const stir = () => {
      clearTimeout(silence);
      silence = setTimeout(() => finish(new Error(`receipt-silent: ${path.basename(file)} absent and no claim stirred for ${silenceMs}ms; broker may have died`)), silenceMs);
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
        if (name !== null && isClaimName(String(name))) stir();
        if (name === null || String(name) === path.basename(file)) read();
      });
      watcher.on('error', error => finish(error));
      stir();
      // LIVENESS: the cap (the longest door run plus two relay pauses) holds even while a claim stirs; a forged claim stretches nothing past it.
      cap = setTimeout(() => finish(new Error(`receipt-cap: ${path.basename(file)} absent after ${capMs}ms, though a claim stirred; a door overran its own bound or a claim was forged`)), capMs);
      read(); // Watch first, then read: an answer arriving during setup cannot get lost.
    } catch (error) { finish(error); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: wait-receipt.mjs <res-id.json>');
    console.log(JSON.stringify(await waitForReceipt(process.argv[2])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
