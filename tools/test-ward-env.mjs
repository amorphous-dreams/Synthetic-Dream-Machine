// test-ward-env — hand the harness's explicit ward and face routes (`test-ward-route.mjs`) to every `lares` CLI process this test
// spawns, through NODE_OPTIONS (seat-harness#/the-ward). The product binary answers neither from a file; a test seats its own.
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const flag = `--import=${pathToFileURL(join(import.meta.dirname, "test-ward-route.mjs")).href}`;
if (!(process.env.NODE_OPTIONS ?? "").includes(flag)) process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, flag].filter(Boolean).join(" ");
