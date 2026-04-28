/**
 * Widget tree — Phase 3 self-hosting pipeline.
 *
 * parseTree (MemeAstNode[])  →  resolveWidgetTree()  →  WidgetNode[]  →  render
 *
 * KumuRegistry holds kumu type definitions collected from the boot artifact.
 * resolveWidgetTree re-types kahea name-form SigilNodes into WidgetNodes.
 *
 * Typed hole semantics (Hazel): when a kumu name is called but not registered,
 * def === null. The WidgetNode still emits — partial edits stay live.
 *
 * Each kumu instance at render time is a causal island: isolated async boundary,
 * events cross via papalohe edges only.
 */

import type { MemeAstNode, KumuDef, WidgetNode } from "./ast.js";

// ---------------------------------------------------------------------------
// KumuRegistry
// ---------------------------------------------------------------------------

export class KumuRegistry {
  private defs = new Map<string, KumuDef>();

  register(def: KumuDef): void {
    this.defs.set(def.name, def);
  }

  get(name: string): KumuDef | undefined {
    return this.defs.get(name);
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  get size(): number {
    return this.defs.size;
  }

  /** All registered definitions. */
  entries(): IterableIterator<[string, KumuDef]> {
    return this.defs.entries();
  }
}

export function buildKumuRegistry(defs: readonly KumuDef[]): KumuRegistry {
  const r = new KumuRegistry();
  for (const d of defs) r.register(d);
  return r;
}

// ---------------------------------------------------------------------------
// Arg parser — "key:val key2:\"quoted val\"" → Record<string, string>
// ---------------------------------------------------------------------------

function parseArgs(argsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!argsStr.trim()) return result;
  const re = /([\w.-]+):\s*(?:"([^"]*)"|([^\s)]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(argsStr)) !== null) {
    result[m[1]!] = m[2] ?? m[3] ?? "";
  }
  return result;
}

// ---------------------------------------------------------------------------
// resolveWidgetTree
// ---------------------------------------------------------------------------

/**
 * Walk a MemeAstNode[] and re-type kahea name-form calls into WidgetNodes.
 * Other nodes are recursed into; their widget children are promoted.
 *
 * Typed holes: when kumuName is not in registry, def === null.
 * The node is still emitted so partial edits remain live.
 */
export function resolveWidgetTree(
  ast: readonly MemeAstNode[],
  registry: KumuRegistry,
): WidgetNode[] {
  const result: WidgetNode[] = [];

  for (const node of ast) {
    // kahea name-form: SigilNode { sigilName:"kahea", attrs:{ name, args } }
    if (node.kind === "Sigil" && node.sigilName === "kahea" && node.attrs["name"]) {
      const name = node.attrs["name"]!;
      const argsStr = node.attrs["args"] ?? "";
      result.push({
        kind:          "Widget",
        kumuName:      name,
        def:           registry.get(name) ?? null,
        resolvedProps: parseArgs(argsStr),
        body:          resolveWidgetTree(node.body, registry),
        pos:           node.pos,
        raw:           node.raw,
      });
      continue;
    }

    // Recurse into block-form nodes; promote any widget children
    if ("body" in node && Array.isArray((node as { body?: unknown }).body)) {
      const children = resolveWidgetTree(
        (node as { body: MemeAstNode[] }).body,
        registry,
      );
      result.push(...children);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// collectKumuDefs — extract KumuDef records from a parsed AST
//
// Called by the compiler for each carrier in the boot closure to populate
// BootArtifact.kumuDefs. A kumu sigil node carries:
//   sigilName: "kumu"
//   attrs: { name, params }   — params is space-separated param names
//   body: MemeAstNode[]        — the template body
// ---------------------------------------------------------------------------

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

    // Recurse — kumu can be nested inside ahu worksites
    if ("body" in node && Array.isArray((node as { body?: unknown }).body)) {
      result.push(
        ...collectKumuDefs(carrierUri, (node as { body: MemeAstNode[] }).body),
      );
    }
  }

  return result;
}
