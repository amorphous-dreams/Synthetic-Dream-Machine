<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/sigil-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/sigil-tw5"
file-path = "packages/lararium-tw5/memes/widgets/sigil-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: SigilWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "SigilWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.sigil = function SigilWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.sigil.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "sigil");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
exports.sigil.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
