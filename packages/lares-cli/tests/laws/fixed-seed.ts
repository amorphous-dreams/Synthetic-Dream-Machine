/**
 * The generated laws' seed. A gate reads the same draws on every run, so a red names a fault and never
 * an unlucky seed: the laws run under a fixed seed unless `LARES_FC_SEED` names another, and
 * `LARES_FC_SEED=random` explores fresh draws (a failure there prints the seed that replays it).
 */
import { fc } from "@fast-check/vitest";

const named = process.env["LARES_FC_SEED"];
if (named !== "random") fc.configureGlobal({ seed: named && /^-?\d+$/.test(named) ? Number(named) : 20261030 });
