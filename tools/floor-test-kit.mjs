/**
 * floor-test-kit — TheFloorTestNeverSeesItsFloor: a test of the floor runs hermetic against temp locks and injected
 * readings, whatever floor runs it (the bench gate's tool-tests leg runs these files INSIDE a live floor run, beside
 * every other tool test, on a loaded and niced box). The floor's own tests (battery, floor-lock, floor-run) share the two
 * helpers here, so one tested definition holds each law.
 *
 *   exited(child)        the child's exit code, read off the child's OWN RECORD first. A bare `child.on('exit')` hung
 *                        the whole gate for 50 minutes (2026-11-26): a test awaited one holder's exit and only then
 *                        listened for the second's, the second had already gone, its event had fired with no listener,
 *                        and the promise never settled. node:test then keeps the process alive for a pending test while
 *                        another stands queued (its harness holds a TIMEOUT_MAX interval), so the file sat at 0% CPU
 *                        with no end. The record (`exitCode`, `signalCode`) outlives the event, so the order two
 *                        children exit in never decides.
 *   floorEnv(lock, extra) the environment a spawned floor tool reads: this process's own, less every mark a live floor
 *                        or a test runner hands down, plus the per-test door. The floor directory derives from that
 *                        door (battery.sh --floor-dir), each run's lock and reservation sit in it, the disk floor reads
 *                        0 and the load per core reads a million, so neither the box's real C: nor its real load ever
 *                        admits, holds or stops a test's run.
 */

/** The names a child must never inherit from the floor (or the test runner) that happens to run the test. */
export const FLOOR_MARKS = Object.freeze([
  'LARES_BATTERY_LOCK', // the live floor's lock: every test names its own
  'LARES_BIN', // the live house's doors: a floor test's ledger lands in its mirror
  'LARES_DISK_MIN_C_GB', 'LARES_DISK_MIN_ROOT_GB', 'LARES_DISK_MAX_SPIRITS', 'LARES_DISK_MAX_CODEX', // the box's disk limits
  'LARES_FLOOR_LOAD_PER_CORE', // the box's load headroom
  'NODE_TEST_CONTEXT', // the runner's own mark: a `node --test` child that inherits it skips its files
]);

/** The hermetic environment for one test's floor: `lock` names the door (an absolute temp path), `extra` rides last. */
export function floorEnv(lock, extra = {}, base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (!FLOOR_MARKS.includes(k)) env[k] = v;
  return { ...env, LARES_BATTERY_LOCK: lock, LARES_DISK_MIN_C_GB: '0', LARES_FLOOR_LOAD_PER_CORE: '1000000', ...extra };
}

/** True once the child has gone, by its own record (an exit code or the signal that ended it). */
export const gone = (child) => child.exitCode !== null || child.signalCode !== null;

/** The child's exit code (null where a signal ended it): off the record where it already went, else off the event. */
export const exited = (child) => new Promise((res) => { if (gone(child)) res(child.exitCode); else child.once('exit', (code) => res(code)); });
