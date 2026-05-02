<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/pranala-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/pranala-tw5"
file-path = "packages/lararium-tw5/memes/widgets/pranala-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: PranalaWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "PranalaWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.pranala = function PranalaWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.pranala.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "pranala");
  el.setAttribute("data-lar-from",   this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",     this.getAttribute("to", ""));
  el.setAttribute("data-lar-family", this.getAttribute("family", ""));
  el.setAttribute("data-lar-role",   this.getAttribute("role", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
exports.pranala.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
