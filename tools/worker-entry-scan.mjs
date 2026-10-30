
// Keep listener event names while hiding comments and other string contents.
export function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (token) => {
    if (/^["'](?:message|connect)["']$/.test(token)) return token;
    return token.replace(/[^\n]/g, " ");
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

