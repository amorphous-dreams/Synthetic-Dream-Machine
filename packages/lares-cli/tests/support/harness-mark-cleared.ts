/**
 * harness-mark-cleared — a vitest setup file: every CLI suite runs with no AI harness mark in its environment, so a run
 * inside Claude Code (`CLAUDECODE=1`) or a Codex sandbox reads exactly as CI does. A CLI line under a harness mark carries
 * the seat's mark (`harnessSeatMarked`), and a suite that wants one names its `env` explicitly. Child processes a suite
 * spawns off `process.env` inherit the cleared environment.
 */
import { HARNESS_SEAT_MARKS } from "../../src/local-connector.js";

for (const mark of HARNESS_SEAT_MARKS) delete process.env[mark];
