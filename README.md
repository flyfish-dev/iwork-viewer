<div align="center">
  <img src="https://github.com/flyfish-dev/iwork-viewer/releases/download/v0.0.2/iwork-viewer-logo.png" width="112" height="112" alt="iWork Viewer logo" />

  <h1>iWork Viewer</h1>

  <p><strong>Render Apple Pages, Numbers, and Keynote documents directly in the browser.</strong></p>
  <p>No server-side conversion. No document upload. No runtime CDN.</p>

  <p>
    <a href="https://www.npmjs.com/package/iwork-viewer"><img alt="npm version" src="https://img.shields.io/npm/v/iwork-viewer?style=flat-square&color=2563eb" /></a>
    <a href="https://github.com/flyfish-dev/iwork-viewer/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/flyfish-dev/iwork-viewer/actions/workflows/ci.yml/badge.svg" /></a>
    <a href="./LICENSE"><img alt="Apache-2.0 license" src="https://img.shields.io/badge/license-Apache--2.0-0f766e?style=flat-square" /></a>
    <img alt="Browser native" src="https://img.shields.io/badge/runtime-browser--native-0f172a?style=flat-square" />
    <img alt="Offline first" src="https://img.shields.io/badge/network-offline--first-f59e0b?style=flat-square" />
  </p>

  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#format-coverage">Format coverage</a> ·
    <a href="#file-viewer-adapter">File Viewer adapter</a> ·
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

---

`iwork-viewer` is a standalone, browser-native renderer for `.pages`, `.numbers`, and `.key` files. It reads both iWork '09 XML/APXL packages and modern Snappy/IWA containers, then renders a static document scene without sending the source file to a conversion service.

The project deliberately separates the document engine from framework integration:

| Package | Purpose | Runtime dependency |
| --- | --- | --- |
| [`iwork-viewer`](https://www.npmjs.com/package/iwork-viewer) | Standalone parser, Worker, scene model, and renderer | No File Viewer dependency |
| [`@file-viewer/renderer-iwork`](https://www.npmjs.com/package/@file-viewer/renderer-iwork) | Thin adapter for File Viewer's renderer contract | `@file-viewer/core >=2.3.0 <3` |

## Why this exists

Uploading a private iWork document just to preview it is a poor default for internal tools, archives, and offline deployments. iWork Viewer keeps parsing and rendering in the browser, exposes a small lifecycle API, and leaves the surrounding product UI to the host application. The preview surface contains document content—not engine labels, license cards, or format-specific marketing chrome.

## Quick start

```bash
pnpm add iwork-viewer@0.0.2
```

Give the viewer a container with an explicit size, then pass a `File`, `Blob`, `ArrayBuffer`, or typed-array source:

```html
<input id="file" type="file" accept=".pages,.numbers,.key" />
<div id="viewer" style="height: 720px"></div>
```

```ts
import { renderIworkDocument } from 'iwork-viewer'

const input = document.querySelector<HTMLInputElement>('#file')
const target = document.querySelector<HTMLDivElement>('#viewer')
if (!input || !target) throw new Error('Missing viewer elements')

const file = input.files?.[0]
if (!file) throw new Error('Select an iWork document first')

const viewer = await renderIworkDocument(file, target, 'pages', {
  embeddedPreview: 'fallback',
  workerTimeoutMs: 60_000,
})

viewer.fit('width')

// Release the Worker, object URLs, and rendered DOM when the view closes.
viewer.destroy()
```

The optional type hint accepts `pages`, `numbers`, or `key`. Container inspection still validates the real file signature and rejects mismatched or malformed inputs.

## Format coverage

| Format | Generations | Static preview coverage | Intentional limits |
| --- | --- | --- | --- |
| Pages | iWork '09 and 2013+ IWA | Paginated and page-layout scenes, text, images, shapes, tables, charts, and styles | No document editing or live layout reflow |
| Numbers | iWork '09 and 2013+ IWA | Multiple freeform sheets and tables, number formats, saved formula results, images, shapes, and charts | Formulas are not recalculated |
| Keynote | iWork '09 and 2013+ IWA | Slides, master backgrounds, text, images, shapes, tables, charts, and presenter notes | Animations, transitions, and video playback stay static |

Encrypted `iwpv2` documents are detected and reported, not decrypted. Embedded Quick Look images may be used as an explicit fallback, but they are never counted as high-fidelity rendering evidence.

## File Viewer adapter

The adapter keeps File Viewer-specific registration, zoom, export, thumbnail, and Worker-path handling outside the standalone engine.

```bash
pnpm add @file-viewer/core@^2.3.0 @file-viewer/renderer-iwork@0.0.2
```

```ts
import { createFileViewer } from '@file-viewer/core'
import iworkRenderer from '@file-viewer/renderer-iwork'

const viewer = createFileViewer({
  container,
  options: {
    renderers: [iworkRenderer],
  },
})
```

Use the standalone package when iWork is the only document family you need. Use the adapter when your application already uses [File Viewer](https://github.com/flyfish-dev/file-viewer) for a broader format matrix.

## Runtime design

- Parsing runs in a module Worker by default and supports abort, timeout, and deterministic teardown.
- ZIP expansion, compression ratio, object count, image pixels, and nesting depth are bounded.
- Modern IWA parsing covers Snappy framing, protobuf archives, object graphs, media, and styles.
- iWork '09 parsing covers Pages/Numbers XML, Keynote APXL, gzip payloads, media, and styles.
- The renderer exposes zoom, fit, print pages, HTML export, thumbnail targeting, and cleanup through one instance.
- All runtime code and assets are packaged locally; the viewer does not fetch a third-party CDN.

## API at a glance

```ts
const viewer = await renderIworkDocument(source, target, type, options)

viewer.fit('contain')
viewer.zoomIn()
viewer.zoomOut()
viewer.setZoom(1.25)
viewer.getZoomState()
viewer.getPrintPages()
viewer.toHtml()
viewer.destroy()
```

Worker options include `workerUrl`, `useWorker`, `workerTimeoutMs`, `embeddedPreview`, and the documented parser resource limits. TypeScript declarations ship with both packages.

## Verification

The repository uses real file-level fixtures with recorded provenance and SHA-256 values. Its regression suite covers iWork '09, 2015-era IWA, and current Pages, Numbers, and Keynote files.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:visual
```

`pnpm verify` builds both packages, runs parser tests, packs the release tarballs, installs the standalone tarball into a clean project, and renders native Pages, Numbers, and Keynote documents through the packaged Worker. Visual gates use fixed fonts and viewport settings with maximum pixel-difference ratios of 3% for Pages/Keynote and 5% for Numbers.

Fixture provenance is recorded in [`test/fixtures/manifest.json`](./test/fixtures/manifest.json). Golden images live in [`test/goldens/`](./test/goldens/).

## Security

Treat every document as untrusted input. The parser runs with explicit resource limits and never executes macros, scripts, Keynote actions, or external programs. Please report security issues privately using the process in [`SECURITY.md`](./SECURITY.md).

## Contributing

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before submitting a change. Every parser or rendering change should include a focused fixture, structural assertions, and—when layout changes—an updated visual baseline with documented provenance.

## License

Licensed under [Apache-2.0](./LICENSE). Third-party notices are listed in [`packages/iwork-viewer/THIRD_PARTY_NOTICES.md`](./packages/iwork-viewer/THIRD_PARTY_NOTICES.md).

Apple, Pages, Numbers, and Keynote are trademarks of Apple Inc. This project is independent and is not affiliated with or endorsed by Apple Inc.
