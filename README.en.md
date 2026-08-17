# iWork Viewer

A browser-native, offline-first static viewer for Apple Pages, Numbers, and Keynote documents.

- `iwork-viewer` works on its own and does not depend on File Viewer.
- `@file-viewer/renderer-iwork` is the thin File Viewer adapter.
- Reads iWork '09 XML/APXL and iWork 2013+ Snappy/IWA containers.
- Runs bounded parsing in a Worker with abort, timeout, and resource limits.
- Numbers displays saved formula results. Keynote animation, transitions, and video playback stay static.
- Encrypted iwpv2 files are detected and reported; browser-side decryption is not claimed.

The project has two explicit package boundaries: the standalone viewer has no File Viewer dependency, while the adapter only implements File Viewer's renderer contract. Both packages stay browser-native and offline-capable, without server conversion or a runtime CDN.

## Install

Standalone:

```bash
pnpm add iwork-viewer@0.0.2
```

File Viewer integration:

```bash
pnpm add @file-viewer/core@^2.3.0 @file-viewer/renderer-iwork@0.0.2
```

## Standalone

```ts
import { renderIworkDocument } from 'iwork-viewer'

const instance = await renderIworkDocument(buffer, document.querySelector('#viewer'), 'pages')
instance.fit('width')
instance.destroy()
```

## File Viewer adapter

```ts
import iworkRenderer from '@file-viewer/renderer-iwork'

const viewer = createFileViewer({
  container,
  options: { renderers: [iworkRenderer] },
})
```

## Scope

- Pages: paginated and page-layout scenes, text, images, shapes, tables, charts, and styles.
- Numbers: multiple freeform sheets and tables, saved formula results, number formats, images, shapes, and charts.
- Keynote: slides, master backgrounds, text, images, shapes, tables, charts, and presenter notes.
- Keynote animations, transitions, and video playback are not executed. Numbers formulas are not recalculated.
- Encrypted iwpv2 is detected only. Unknown IWA object graphs are limited previews and are not fidelity evidence.

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Real Apple fixture provenance and SHA-256 values live in `test/fixtures/manifest.json`; visual baselines live in `test/goldens/`. Report security issues privately as described in [SECURITY.md](./SECURITY.md).
