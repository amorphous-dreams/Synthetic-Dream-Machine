/**
 * The mutation pilot's vitest config (stryker.config.json names it): the law suite, less the laws that read source
 * text. Stryker instruments a mutated file in place, so a law that counts or parses that file's text reads the
 * instrumentation, never a mutant; those laws keep their own proof in the law-mutant run and the package suite.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import laws from "./vitest.law-mutants.config";

export const READS_SOURCE_TEXT: string[] = [];

export default mergeConfig(laws, defineConfig({ test: { exclude: [...READS_SOURCE_TEXT, "**/node_modules/**"] } }));
