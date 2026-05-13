/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/lar-promote
type: application/javascript
module-type: library
\*/
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/modules/lar-promote.ts
/**
* promoteUris — move tiddlers from the wiki bag into a canon bag.
*
* For each URI in `uris`:
*   1. Read the target bag's oracle tiddler (title = targetBagId).
*   2. Evaluate oracle's `path-filter` over [uri] to get the mirror-relative path.
*   3. Set `bag` and `file-path` on the tiddler; write via wiki.addTiddler().
*   4. Tombstone the wiki-bag copy via wiki.deleteTiddler() so @lares surfaces.
*
* @param tw     — the TW5 root object (provides Tiddler constructor)
* @param wiki   — the TW5 wiki object ($tw.wiki)
* @param uris   — lar: URIs to promote
* @param targetBagId — e.g. "lar:///ha.ka.ba/@lares"
*/
function promoteUris(tw, wiki, uris, targetBagId) {
	const oracle = wiki.getTiddler(targetBagId);
	if (!oracle) return {
		promoted: [],
		skipped: uris.slice(),
		error: "no oracle tiddler: " + targetBagId
	};
	const pathFilter = oracle.fields["path-filter"];
	const mirrorRoot = oracle.fields["mirror-root"];
	if (!pathFilter || !mirrorRoot) return {
		promoted: [],
		skipped: uris.slice(),
		error: "oracle missing path-filter/mirror-root: " + targetBagId
	};
	const promoted = [];
	const skipped = [];
	for (const uri of uris) {
		const existing = wiki.getTiddler(uri);
		if (!existing) {
			skipped.push(uri);
			continue;
		}
		const filterExpr = "[title[" + uri + "]" + pathFilter + "]";
		const relPaths = wiki.filterTiddlers(filterExpr);
		if (!relPaths || relPaths.length === 0) {
			skipped.push(uri);
			continue;
		}
		const filePath = mirrorRoot + "/" + relPaths[0];
		wiki.addTiddler(new tw.Tiddler(existing, {
			bag: targetBagId,
			"file-path": filePath
		}));
		wiki.deleteTiddler(uri);
		promoted.push(uri);
	}
	return {
		promoted,
		skipped
	};
}
//#endregion
exports.promoteUris = promoteUris;
