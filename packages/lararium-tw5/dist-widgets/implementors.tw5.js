Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/filters/implementors.ts
/** Exact-token match on space-separated `implements` field.
*  TW5's built-in field: operator does substring matching, which breaks when one
*  URI is a prefix of another. This uses parseStringArray for exact token matching. */
function registerImplementors(tw) {
	tw.filterOperators["implementors"] = function(source, operator) {
		const target = operator.operand ?? "";
		const results = [];
		source(function(tiddler, title) {
			if (!tiddler) return;
			const raw = String(tiddler.fields?.["implements"] ?? "");
			if ((tw.utils.parseStringArray(raw) ?? []).includes(target)) results.push(title);
		});
		return results;
	};
}
//#endregion
exports.registerImplementors = registerImplementors;
