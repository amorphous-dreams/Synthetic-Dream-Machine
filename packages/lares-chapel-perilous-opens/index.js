import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export const chapelRoot = dirname(fileURLToPath(import.meta.url));
