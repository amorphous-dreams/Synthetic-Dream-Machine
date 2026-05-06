<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pae-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/pae-tw5"
file-path = "packages/lararium-tw5/memes/widgets/pae-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: PaeWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "PaeWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/pae.ts
function PaeWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PaeWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.domNodes = [];
};
PaeWidget.prototype.execute = function() {};
//#endregion
exports.PaeWidget = PaeWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "PaeWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/pae`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
