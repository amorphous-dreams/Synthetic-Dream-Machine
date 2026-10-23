import type { MemeAstNode } from "./types.js";

export interface WidgetTreeNode {
  readonly kind: string;
  readonly children: readonly WidgetTreeNode[];
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly affordances?: readonly { readonly kind: string; readonly target?: string }[];
  readonly degraded?: { readonly reason: string };
}

/** Registry keys name AST kinds, prose structures, or `sigil:<name>`. */
export interface WidgetRegistry {
  readonly kinds: Readonly<Record<string, string>>;
  readonly sigils: Readonly<Record<string, string>>;
}

export const defaultWidgetRegistry: WidgetRegistry = {
  kinds: {
    Ahu: "section", Pranala: "link-handle", PranalaSugar: "link-handle",
    Lele: "action", Pae: "frame", Text: "text", Sigil: "sigil",
    Dynamic: "sigil", Error: "degraded", heading: "section",
    paragraph: "paragraph", list: "list", listItem: "list-item",
    codeFence: "code", link: "link-handle",
  },
  sigils: {
    ahu: "section", loulou: "link-handle", kanawai: "link-handle",
    node: "node", lares: "frame", set: "frame", oracle: "frame",
  },
};

function degraded(reason: string, raw: string, children: readonly WidgetTreeNode[] = []): WidgetTreeNode {
  return { kind: "degraded", children, text: raw, degraded: { reason } };
}

function mapped(registry: WidgetRegistry, kind: string, children: readonly WidgetTreeNode[], attrs?: Readonly<Record<string, string>>): WidgetTreeNode {
  const semantic = registry.kinds[kind];
  return semantic ? { kind: semantic, children, ...(attrs ? { attrs } : {}) } : degraded(`unknown-kind:${kind}`, "", children);
}

function textNode(value: string, registry: WidgetRegistry): WidgetTreeNode {
  const kind = registry.kinds.Text;
  return kind ? { kind, children: [], text: value } : degraded("unknown-kind:Text", value);
}

function inline(source: string, registry: WidgetRegistry): WidgetTreeNode[] {
  const result: WidgetTreeNode[] = [];
  const pattern = /\[\[(?:(.*?)\|)?([^\]]+)\]\]/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    if (start > cursor) result.push(textNode(source.slice(cursor, start), registry));
    const target = match[2] ?? "";
    const label = match[1] ?? target;
    const kind = registry.kinds.link;
    result.push(kind
      ? { kind, children: [textNode(label, registry)], attrs: { target }, affordances: [{ kind: "link", target }] }
      : degraded("unknown-kind:link", match[0]));
    cursor = start + match[0].length;
  }
  if (cursor < source.length) result.push(textNode(source.slice(cursor), registry));
  return result;
}

function prose(source: string, registry: WidgetRegistry): WidgetTreeNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: WidgetTreeNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) { i++; continue; }
    const heading = /^(!{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(mapped(registry, "heading", inline(heading[2] ?? "", registry), { level: String(heading[1]?.length ?? 1) }));
      i++; continue;
    }
    const list = /^([*#])\s+(.*)$/.exec(line);
    if (list) {
      const marker = list[1];
      const items: WidgetTreeNode[] = [];
      while (i < lines.length) {
        const item = new RegExp(`^\\${marker}\\s+(.*)$`).exec(lines[i] ?? "");
        if (!item) break;
        items.push(mapped(registry, "listItem", inline(item[1] ?? "", registry)));
        i++;
      }
      out.push(mapped(registry, "list", items, { ordered: marker === "#" ? "true" : "false" }));
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith("```")) code.push(lines[i++] ?? "");
      if (i === lines.length) out.push(degraded("unclosed-code-fence", [line, ...code].join("\n")));
      else { i++; out.push(mapped(registry, "codeFence", [textNode(code.join("\n"), registry)])); }
      continue;
    }
    if (/<\$[a-z][\w-]*/i.test(line)) {
      out.push(degraded("unsupported-tw5-widget", line)); i++; continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i]?.trim() && !/^(?:!{1,6}\s|[*#]\s|```)/.test(lines[i] ?? "")) paragraph.push(lines[i++] ?? "");
    out.push(mapped(registry, "paragraph", inline(paragraph.join("\n"), registry)));
  }
  return out;
}

/** Resolve the in-VM MemeAst; every unregistered construct leaves a named mark. */
export function resolveWidgetTree(ast: MemeAstNode[], registry: WidgetRegistry): WidgetTreeNode[] {
  const visit = (node: MemeAstNode): WidgetTreeNode[] => {
    if (node.kind === "Text") return prose(node.content, registry);
    if (node.kind === "Error") return [degraded(`parse-error:${node.reason}`, node.content)];
    const body = "body" in node && Array.isArray(node.body) ? node.body.flatMap(visit) : [];
    if (node.kind === "Ahu") {
      const kind = registry.sigils.ahu;
      return [kind ? { kind, children: body, attrs: { slot: node.slot, uri: node.uri } } : degraded("unknown-sigil:ahu", node.raw, body)];
    }
    if (node.kind === "Sigil" || node.kind === "Dynamic") {
      const kind = registry.sigils[node.sigilName];
      return [kind ? { kind, children: body, attrs: node.kind === "Sigil" ? node.attrs : { sigilKind: node.sigilKind } } : degraded(`unknown-sigil:${node.sigilName}`, node.raw, body)];
    }
    if (node.kind === "PranalaSugar") {
      const kind = registry.sigils[node.sigil];
      const target = node.toRaw;
      return [kind ? { kind, children: [], attrs: { target }, affordances: [{ kind: "link", target }] } : degraded(`unknown-sigil:${node.sigil}`, node.raw)];
    }
    const kind = registry.kinds[node.kind];
    if (!kind) return [degraded(`unknown-kind:${node.kind}`, node.raw, body)];
    if (node.kind === "Pranala") return [{ kind, children: body, attrs: { target: node.toRaw }, affordances: [{ kind: "link", target: node.toRaw }] }];
    return [{ kind, children: body }];
  };
  return ast.flatMap(visit);
}
