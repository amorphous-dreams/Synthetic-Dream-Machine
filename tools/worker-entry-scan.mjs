
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
export function listenerIndex(source) {
  const code = codeOnly(source);
  const match = /\.addEventListener\s*\(\s*["'](?:message|connect)["']|\brunBrowserSovereignWorker\s*\(|\bhost\.listen\s*\(/.exec(code);
  return match?.index ?? -1;
}
export function violation(name, source) {
  const code = codeOnly(source), index = listenerIndex(source);
  if (index < 0) return `${name}: no listener`;
  return /\bawait\b/.test(code.slice(0, index)) ? name : null;
}

