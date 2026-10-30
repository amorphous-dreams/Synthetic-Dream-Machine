/**
 * The mutation run's fixed seed: a generated law names its run by seed, and a mutation run reads the
 * same names on every mutant, so its draws stay the same across them.
 */
import { fc } from "@fast-check/vitest";

fc.configureGlobal({ seed: 20261030 });
