import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export const laresRoot = dirname(fileURLToPath(import.meta.url));
