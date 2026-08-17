# Contributing

Use Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Changes to parsing or rendering must include a fixture-level regression assertion. Do not commit private customer documents. Public fixtures require recorded provenance, license, SHA-256, expected structure, and visual evidence where layout is affected.

Keep `iwork-viewer` independent from File Viewer. File Viewer-specific integration belongs only in `@file-viewer/renderer-iwork`. Runtime network services, CDNs, server conversion, and Apple application automation are outside the package boundary.

Use `feature/` or `fix/` branches. Do not inject format titles, engine labels, diagnostics, license cards, or promotional content into document preview surfaces.
