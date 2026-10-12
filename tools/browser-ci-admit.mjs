/**
 * The runner side of the browser-ci ADMIT EXCHANGE (see the header of tools/browser-ci.sh).
 *
 * The runner holds no Docker, so it cannot issue an admit. It prints `ADMIT-REQUEST <64-hex key>` on stdout and
 * the host driver (`browser-ci.sh qa-admit …`) answers by writing `<key>.admit` (one `#admit=…` line) or
 * `<key>.refused` (the refusal text) into the shared directory. One call asks for one key; call it again for the
 * next fresh profile. The wait reads the directory's state; `timeoutMs` only bounds it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The host answered with a refusal, or never answered inside the bound. The message names which. */
export class AdmitRefused extends Error {
  constructor(message) { super(message); this.name = "AdmitRefused"; }
}

export async function requestAdmit(key, { dir = process.env.BROWSER_CI_EXCHANGE, timeoutMs = 60_000 } = {}) {
  if (!dir) throw new AdmitRefused("AdmitRefused: BROWSER_CI_EXCHANGE is unset; run through `browser-ci.sh qa-admit`");
  if (!/^[0-9a-f]{64}$/.test(key)) throw new AdmitRefused(`AdmitRefused: the joinee key must be 64 lowercase hex characters, got "${key}"`);
  console.log(`ADMIT-REQUEST ${key}`);
  const read = (name) => readFile(join(dir, name), "utf8").catch(() => null);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const refused = await read(`${key}.refused`);
    if (refused !== null) throw new AdmitRefused(`AdmitRefused: ${refused.trim()}`);
    const admit = await read(`${key}.admit`);
    if (admit !== null) {
      const line = admit.trim();
      if (!line.startsWith("#admit=")) throw new AdmitRefused(`AdmitRefused: the host answered no #admit= fragment: ${line.slice(0, 80)}`);
      return line;
    }
    if (Date.now() >= deadline) throw new AdmitRefused(`AdmitRefused: no answer from the host for ${key} within ${timeoutMs}ms; was the runner started with qa-admit?`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
