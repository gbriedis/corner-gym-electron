# Lessons

> Read before every session.
> Add an entry after every correction.

## Format
```
## [Date] — mistake summary
What happened:
Rule going forward:
```

---

## 2026-04-08 — Desktop compiled as CJS, engine is ESM → runtime crash
What happened: Desktop tsconfig had `"module": "CommonJS"` override. Engine is `"type": "module"`. At runtime Electron threw `ERR_REQUIRE_ESM` — `require()` cannot load an ES module.
Rule going forward: Desktop must always use NodeNext (inheriting from tsconfig.base.json). Never override to CommonJS. Any new package that imports from the engine must also be ESM. Check `"type": "module"` is present in package.json.
