# iWork Viewer repository rules

- This repository owns the browser-native Apple Pages, Numbers, and Keynote parser, Worker, scene renderer, fixtures, and visual evidence.
- `iwork-viewer` must remain standalone and must not import `@file-viewer/core`.
- `@file-viewer/renderer-iwork` is the only File Viewer adapter and keeps `@file-viewer/core` as a peer dependency.
- All parsing and rendering must work offline. Do not add runtime CDN, server conversion, Apple application automation, or public network dependencies.
- Preserve document-native preview surfaces. Do not inject format, engine, license, diagnostic, or promotional cards into rendered documents.
- Embedded Quick Look previews are fallback evidence only. Do not use them to satisfy fidelity tests.
- Keep Pages and Keynote visual thresholds at 3% and Numbers at 5% unless a separately reviewed evidence update justifies a change.
- Use `feature/` or `fix/` branches. Never use `codex/` or `agent/`.
- Publishing, remote creation, and external writes require explicit user authorization.
