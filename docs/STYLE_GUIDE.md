# Code Style (short version)

* **TS strict-mode** – no `any`, ever.  
* **Absolute imports** from `src/…`, relative only within the same folder.  
* **React** – functional components + hooks; no classes.  
* **Commits** – Conventional Commits (`feat:`, `fix:`, …).  
* **Tests** – colocate `*.test.ts` next to code.

See `.cursor/rules/*` for full linter config.
```