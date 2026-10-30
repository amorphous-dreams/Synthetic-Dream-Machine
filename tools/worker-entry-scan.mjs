/**
 * Reads a worker entry's source for an `await` ahead of the entry's message or connect listener.
 * The source parses as a module (esbuild strips TypeScript types, acorn reads the result), and the walk follows
 * execution order over the TOP-LEVEL statements: a call or an `await` counts only when it is reachable without
 * crossing a function boundary, because anything inside a function runs when that function is called, not at load.
 */
import { transformSync } from "esbuild";
import { parse as parseModule } from "acorn";

// Keep listener event names and the executable `${...}` parts of template literals while hiding comments and the
// remaining string contents.
function blank(text) { return text.replace(/[^\n]/g, " "); }
function templateCode(token) {
  let out = "", i = 0;
  while (i < token.length) {
    if (token[i] === "$" && token[i + 1] === "{") {
      let depth = 1, j = i + 2;
      while (j < token.length && depth > 0) { if (token[j] === "{") depth++; else if (token[j] === "}") depth--; j++; }
      out += "  " + token.slice(i + 2, j - 1) + " ";
      i = j;
    } else { out += token[i] === "\n" ? "\n" : " "; i++; }
  }
  return out;
}
export function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (token) => {
    if (/^["'](?:message|connect)["']$/.test(token)) return token;
    if (token.startsWith("`")) return templateCode(token);
    return blank(token);
  });
}

const FUNCTION_NODES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
function registersListener(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type === "Identifier") return callee.name === "runBrowserSovereignWorker";
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (callee.property.name === "addEventListener") {
    const first = node.arguments[0];
    return first?.type === "Literal" && (first.value === "message" || first.value === "connect");
  }
  return callee.property.name === "listen" && callee.object.type === "Identifier" && callee.object.name === "host";
}
function awaitsAtLoad(node) {
  return node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await === true);
}
/** What one top-level statement does at load: where its first listener registration starts and whether it awaits first. */
function scanStatement(statement) {
  let listener = -1, awaitBeforeListener = false, awaits = false;
  const events = [];
  (function visit(node) {
    if (!node || typeof node.type !== "string") return;
    if (FUNCTION_NODES.has(node.type)) return;
    if (awaitsAtLoad(node)) events.push({ kind: "await", end: node.end });
    if (registersListener(node)) events.push({ kind: "listen", start: node.start, end: node.end });
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) for (const child of value) visit(child);
      else if (value && typeof value === "object") visit(value);
    }
  })(statement);
  for (const event of events.sort((a, b) => (a.kind === "await" ? a.end : a.start) - (b.kind === "await" ? b.end : b.start))) {
    if (event.kind === "await") { awaits = true; if (listener < 0) awaitBeforeListener = true; }
    else if (listener < 0) listener = event.start;
  }
  return { listener, awaitBeforeListener, awaits };
}
function statementsOf(source) {
  const js = transformSync(source, { loader: "ts", format: "esm", target: "esnext", sourcemap: false }).code;
  return parseModule(js, { ecmaVersion: "latest", sourceType: "module" }).body;
}

export function listenerIndex(source) {
  for (const statement of statementsOf(source)) {
    const { listener } = scanStatement(statement);
    if (listener >= 0) return listener;
  }
  return -1;
}
export function violation(name, source) {
  let awaited = false;
  for (const statement of statementsOf(source)) {
    const result = scanStatement(statement);
    if (result.listener >= 0) return awaited || result.awaitBeforeListener ? name : null;
    if (result.awaits) awaited = true;
  }
  return `${name}: no listener`;
}
