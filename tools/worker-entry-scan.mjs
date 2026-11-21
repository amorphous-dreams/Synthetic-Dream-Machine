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
function registersListener(node, starters, kinds, scopes) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type === "Identifier") return callee.name === "runBrowserSovereignWorker" || starters.has(callee.name);
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (callee.property.name === "addEventListener") {
    // Only the worker's own scope receives the worker's messages: another EventTarget is no listener.
    const scope = callee.object.type === "Identifier" && (callee.object.name === "self" || callee.object.name === "globalThis" || scopes.has(callee.object.name));
    const first = node.arguments[0];
    return scope && first?.type === "Literal" && kinds.has(first.value);
  }
  return callee.property.name === "listen" && callee.object.type === "Identifier" && callee.object.name === "host";
}
function awaitsAtLoad(node) {
  return node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await === true);
}
/** What one top-level statement does at load: where its first listener registration completes (after its arguments evaluate) and whether it awaits first. */
function scanStatement(statement, starters, kinds, scopes) {
  let listener = -1, awaitBeforeListener = false, awaits = false;
  const events = [];
  // `maybe` marks code that may not run at load (a branch, a loop body, a short-circuit, a catch, a class body): an await
  // there still counts against a later listener, but a listener there does not stand.
  (function visit(node, maybe) {
    if (!node || typeof node.type !== "string") return;
    if (FUNCTION_NODES.has(node.type) || node.type === "ClassBody") return;
    if (awaitsAtLoad(node)) events.push({ kind: "await", end: node.end });
    if (!maybe && registersListener(node, starters, kinds, scopes)) events.push({ kind: "listen", start: node.end, end: node.end });
    for (const key of Object.keys(node)) {
      const value = node[key];
      const later = maybe
        || (node.type === "IfStatement" && key !== "test")
        || (node.type === "ConditionalExpression" && key !== "test")
        || (node.type === "LogicalExpression" && key === "right")
        || (node.type === "SwitchCase" && key === "consequent")
        || (/^(?:For|ForIn|ForOf|While|DoWhile)Statement$/.test(node.type) && key === "body")
        || (node.type === "TryStatement" && key === "handler");
      if (Array.isArray(value)) for (const child of value) visit(child, later);
      else if (value && typeof value === "object") visit(value, later);
    }
  })(statement, false);
  for (const event of events.sort((a, b) => a.end - b.end || (a.kind === "listen" ? -1 : 1) - (b.kind === "listen" ? -1 : 1))) {
    if (event.kind === "await") { awaits = true; if (listener < 0) awaitBeforeListener = true; }
    else if (listener < 0) listener = event.start;
  }
  return { listener, awaitBeforeListener, awaits };
}
function statementsOf(source) {
  const js = transformSync(source, { loader: "ts", format: "esm", target: "esnext", sourcemap: false }).code;
  return parseModule(js, { ecmaVersion: "latest", sourceType: "module" }).body;
}

/** Top-level names bound straight to the worker scope (`const sw = globalThis`), after the types are stripped. */
function scopeAliases(statements) {
  const names = new Set();
  for (const statement of statements) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const d of statement.declarations) {
      if (d.id.type === "Identifier" && d.init?.type === "Identifier" && (d.init.name === "self" || d.init.name === "globalThis" || names.has(d.init.name))) names.add(d.id.name);
    }
  }
  return names;
}

export function listenerIndex(source) {
  for (const statement of statementsOf(source)) {
    const { listener } = scanStatement(statement, new Set(), MESSAGE_OR_CONNECT, scopeAliases(statementsOf(source)));
    if (listener >= 0) return listener;
  }
  return -1;
}
/** `starters` names functions this entry imports whose body registers the listener (the call counts where it runs at load). */
const MESSAGE_OR_CONNECT = new Set(["message", "connect"]);
export function violation(name, source, starters = []) {
  return scan(name, source, starters, MESSAGE_OR_CONNECT, "no listener");
}
/** A SharedWorker entry registers `connect` itself in its synchronous top level. */
export function sharedViolation(name, source) {
  return scan(name, source, [], new Set(["connect"]), "no connect listener");
}
function scan(name, source, starters, kinds, missing) {
  const known = new Set(starters);
  let awaited = false;
  const all = statementsOf(source), scopes = scopeAliases(all);
  for (const statement of all) {
    const result = scanStatement(statement, known, kinds, scopes);
    if (result.listener >= 0) return awaited || result.awaitBeforeListener ? name : null;
    if (result.awaits) awaited = true;
  }
  return `${name}: ${missing}`;
}
