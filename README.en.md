# iWork Viewer

A browser-native, offline-first static viewer for Apple Pages, Numbers, and Keynote documents.

- `iwork-viewer` works on its own and does not depend on File Viewer.
- `@file-viewer/renderer-iwork` is the thin File Viewer adapter.
- Reads iWork '09 XML/APXL and iWork 2013+ Snappy/IWA containers.
- Runs bounded parsing in a Worker with abort, timeout, and resource limits.
- Numbers displays saved formula results. Keynote animation, transitions, and video playback stay static.
- Encrypted iwpv2 files are detected and reported; browser-side decryption is not claimed.

This repository is currently a local extraction workspace. No public remote or npm release has been created.

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
