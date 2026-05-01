<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/toml-field >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/filters/toml-field"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/filters/toml-field.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerTomlFieldOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
source-symbol = "registerTomlFieldOperator"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/filters/toml-field-tw5"
body-sha256   = "e2fb66d90289728c8930377b283a89ebb0452128e042cc41bfcc6a5677251ca9"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`toml:fieldName[value]` — returns tiddlers where `fields[fieldName] === value`. Used for TOML-indexed field queries.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
tw.filterOperators["toml"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
  const fieldName = operator.suffix ?? "";
  const value     = operator.operand ?? "";
  const results: string[] = [];
  source(function (tiddler, title: string) {
    if (!tiddler) return;
    const fv: string = String(tiddler.fields?.[fieldName] ?? "");
    if (fv === value) results.push(title);
  });
  return results;
};
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/toml-field-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
