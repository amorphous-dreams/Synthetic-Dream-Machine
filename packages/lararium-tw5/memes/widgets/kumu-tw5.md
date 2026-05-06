<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kumu-tw5"
file-path = "packages/lararium-tw5/memes/widgets/kumu-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: KumuWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "KumuWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/kumu.ts
function KumuWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
KumuWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const name = this.getAttribute("name", "");
	const args = this.getAttribute("props", "");
	const defUri = (this.wiki?.filterTiddlers?.(`[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`) ?? [])[0] ?? "";
	const el = this.document.createElement("div");
	el.setAttribute("data-lar-kind", "kumu");
	el.setAttribute("data-lar-name", name);
	el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
	parent.appendChild(el);
	this.domNodes = [el];
	if (defUri) {
		const propRe = /([\w-]+):(\S+)/g;
		let m;
		while ((m = propRe.exec(args)) !== null) this.setVariable(m[1], m[2]);
		const transclude = this.wiki?.makeTranscludeWidget(defUri, {
			document: this.document,
			parentWidget: this
		});
		if (transclude) {
			transclude.render(el, null);
			this.children = [transclude];
		}
	} else {
		const hole = this.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? ${name}`;
		el.appendChild(hole);
	}
};
KumuWidget.prototype.execute = function() {};
KumuWidget.prototype.refresh = function(changedTiddlers) {
	let changed = false;
	for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
	return changed;
};
//#endregion
exports.KumuWidget = KumuWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "KumuWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/kumu`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
