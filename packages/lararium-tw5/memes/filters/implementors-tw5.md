<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/implementors-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/implementors-tw5"
file-path = "packages/lararium-tw5/memes/filters/implementors-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: implementors — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerImplementorsOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.implementors = function(source, operator) {
  var target  = operator.operand ?? "";
  var results = [];
  source(function(tiddler, title) {
    if (!tiddler) return;
    var raw    = String(tiddler.fields?.["implements"] ?? "");
    var tokens = $tw.utils.parseStringArray(raw) ?? [];
    if (tokens.includes(target)) results.push(title);
  });
  return results;
};
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
