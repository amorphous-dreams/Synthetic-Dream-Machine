<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kukali-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kukali-tw5"
file-path = "packages/lararium-tw5/memes/widgets/kukali-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: KukaliWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "KukaliWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/kukali.ts
function KukaliWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
KukaliWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const listenable = this.getAttribute("listenable", "");
	const uri = this.getAttribute("uri", "") || (this.getVariable?.("currentTiddler") ?? "");
	const el = this.document.createElement("span");
	el.setAttribute("data-lar-kind", "kukali");
	el.setAttribute("data-lar-listenable", listenable);
	el.setAttribute("data-lar-uri", uri);
	parent.appendChild(el);
	this.domNodes = [el];
	if (uri && listenable && this.wiki?.dispatchEvent) this.wiki.dispatchEvent("tm-lararium-event", {
		uri,
		listenable
	});
};
KukaliWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.KukaliWidget = KukaliWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "KukaliWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/kukali`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
