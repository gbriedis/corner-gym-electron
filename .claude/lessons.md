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

## 2026-04-08 — Native module ABI mismatch: better-sqlite3 built for system Node, Electron needs its own ABI
What happened: better-sqlite3 compiled for system Node.js (MODULE_VERSION 127). Electron 33 embeds a different Node.js (MODULE_VERSION 130). Runtime crash: ERR_DLOPEN_FAILED.
Rule going forward: After adding any native module (`.node` binary), rebuild it for Electron's Node ABI. `.npmrc` in the project root must set `runtime=electron`, `target=<electron-version>`, `dist_url=https://electronjs.org/headers` so fresh `pnpm install` gets the right binary automatically. Also: better-sqlite3 v9 cannot compile against Electron 33 headers (missing struct member); use v11+.

## 2026-04-08 — Desktop compiled as CJS, engine is ESM → runtime crash
What happened: Desktop tsconfig had `"module": "CommonJS"` override. Engine is `"type": "module"`. At runtime Electron threw `ERR_REQUIRE_ESM` — `require()` cannot load an ES module.
Rule going forward: Desktop must always use NodeNext (inheriting from tsconfig.base.json). Never override to CommonJS. Any new package that imports from the engine must also be ESM. Check `"type": "module"` is present in package.json.
