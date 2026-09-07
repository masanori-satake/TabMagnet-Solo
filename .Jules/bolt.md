## 2025-02-17 - RegExp Compilation Caching in URL Pattern Matching

**Learning:** In tab matching loops over open browser tabs, compiling `new RegExp` on every `matchUrl` call introduces unnecessary GC pressure and string processing overhead. Since regexes without stateful flags (`g` or `y`) are stateless, caching compiled `RegExp` objects in a `Map` safely eliminates recompilation overhead across calls.
**Action:** Always cache compiled `RegExp` instances for stateless URL pattern matching in repetitive tab filter loops.
