/**
 * testing — THE TEST-ONLY ENTRY of `@lararium/browser`: seams a witness seats and a product page never reaches. The package index
 * re-exports none of them.
 *
 * `seatWardWorkerSpawn` seats the spawn every ward act on this page runs (a witness runs the pure ward core in-process); null takes
 * the worker back. No door takes a caller's spawn, so a product caller cannot swap the per-act worker for its own.
 */
export { seatWardWorkerSpawnForTests as seatWardWorkerSpawn, type WardWorkerHandle, type WardWorkerSpawn } from "./browser-ward.js";
