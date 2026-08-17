# @file-viewer/renderer-iwork

The thin File Viewer adapter for `iwork-viewer`. Parsing and scene rendering live in the standalone package; this package only connects format registration, Worker paths, zoom, export, and thumbnail contracts.

```bash
pnpm add @file-viewer/core @file-viewer/renderer-iwork@0.0.1
```

```ts
import iworkRenderer from '@file-viewer/renderer-iwork'

const viewer = createFileViewer({
  container,
  options: { renderers: [iworkRenderer] },
})
```

Supports `.pages`, `.numbers`, and `.key`, while loading the standalone `iwork-viewer` Worker on demand. See [GitHub](https://github.com/flyfish-dev/iwork-viewer) for details.
