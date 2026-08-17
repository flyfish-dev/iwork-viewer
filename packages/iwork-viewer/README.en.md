# iwork-viewer

A browser-native, offline-first static viewer for Apple Pages, Numbers, and Keynote. It has no File Viewer, server-conversion, or runtime-CDN dependency.

```bash
pnpm add iwork-viewer@0.0.1
```

```ts
import { renderIworkDocument } from 'iwork-viewer'

const viewer = await renderIworkDocument(buffer, document.querySelector('#viewer'), 'pages')
viewer.fit('width')
viewer.destroy()
```

Reads iWork '09 XML/APXL and modern Snappy/IWA containers. Numbers displays saved formula results; Keynote animation, transitions, and video stay static; encrypted iwpv2 is detected but not decrypted.

See [GitHub](https://github.com/flyfish-dev/iwork-viewer) for compatibility details, fixtures, visual gates, and the Chinese README.
