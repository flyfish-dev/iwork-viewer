# @file-viewer/renderer-iwork

`iwork-viewer` 的 File Viewer 薄适配包。解析与场景渲染由独立包提供；本包只连接格式注册、Worker 路径、缩放、导出和缩略图契约。

```bash
pnpm add @file-viewer/core@^2.3.0 @file-viewer/renderer-iwork@0.0.2
```

```ts
import iworkRenderer from '@file-viewer/renderer-iwork'

const viewer = createFileViewer({
  container,
  options: { renderers: [iworkRenderer] },
})
```

支持 `.pages`、`.numbers`、`.key`，并按需加载独立 `iwork-viewer` Worker。完整说明见 [GitHub](https://github.com/flyfish-dev/iwork-viewer)。
