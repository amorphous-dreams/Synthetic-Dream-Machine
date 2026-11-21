import type { ParsedArgs } from "../parse-args.js";
import { promotionDoor } from "./promote.js";

export const cmdKapae = (args: ParsedArgs) => promotionDoor(args, "kapae");
