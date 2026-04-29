/**
 * collectKumuDefs — extract KumuDef records from a parsed carrier AST.
 *
 * Called by the compiler for each carrier in the boot closure to populate
 * BootArtifact.kumuDefs. Kumu defs are then injected as TW5 tiddlers by
 * LarariumTW5.injectKumuDefs() so TW5 can resolve them natively at render time.
 */

import type { MemeAstNode, KumuDef } from "./ast.js";

export function collectKumuDefs(
  carrierUri: string,
  ast: readonly MemeAstNode[],
): KumuDef[] {
  const result: KumuDef[] = [];

  for (const node of ast) {
    if (node.kind === "Sigil" && node.sigilName === "kumu" && node.attrs["name"]) {
      const name = node.attrs["name"]!;
      const paramsStr = node.attrs["params"] ?? "";
      const params = paramsStr.split(/[\s,]+/).filter(Boolean);
      result.push({ name, params, carrierUri, body: node.body });
    }

    // Recurse — kumu defs can be nested inside ahu worksites
    if ("body" in node && Array.isArray((node as { body?: unknown }).body)) {
      result.push(
        ...collectKumuDefs(carrierUri, (node as { body: MemeAstNode[] }).body),
      );
    }
  }

  return result;
}
