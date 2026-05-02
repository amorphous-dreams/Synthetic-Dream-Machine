<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/papalohe-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/papalohe-tw5"
file-path = "packages/lares/api/v0.1/lararium/widgets/papalohe-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: PapaloheWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "PapaloheWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.papalohe = function PapaloheWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.papalohe.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",    "papalohe");
  el.setAttribute("data-lar-from",    this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",      this.getAttribute("to", ""));
  el.setAttribute("data-lar-trigger", this.getAttribute("trigger", ""));
  el.setAttribute("data-lar-fn",      this.getAttribute("fn", ""));
  el.setAttribute("data-lar-slot",    this.getAttribute("slot", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
exports.papalohe.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
