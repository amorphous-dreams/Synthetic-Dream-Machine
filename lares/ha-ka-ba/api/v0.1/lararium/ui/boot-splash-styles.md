<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/ui/boot-splash-styles >>
```toml iam
uri-path     = "ha.ka.ba/api/v0.1/lararium/ui/boot-splash-styles"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/ui/boot-splash-styles.md"
type         = "text/vnd.tiddlywiki"
register     = "CS"
confidence   = 0.88
mana         = 0.88
manao        = 0.85
manaoio      = 0.82
role         = "CSS for Lararium boot-splash banner — visible while causal islands warm"
cacheable    = true
retain       = true
tags         = ["$:/tags/Stylesheet"]
```



<<~&#x0002;>>

.lar-boot-banner {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: #1a1a2e;
  color: #e0e0ff;
  border-radius: 8px;
  padding: .6rem 1.2rem;
  font-size: .85rem;
  font-family: monospace;
  box-shadow: 0 2px 12px rgba(0,0,0,.4);
  z-index: 9999;
  animation: lar-pulse 2s ease-in-out infinite;
}

@keyframes lar-pulse {
  0%, 100% { opacity: .8; }
  50%       { opacity: 1; }
}

<<~&#x0003;>>
<<~&#x0004; -> ? >>
