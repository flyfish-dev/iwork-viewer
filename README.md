# iWork Viewer

浏览器原生、离线优先的 Apple Pages、Numbers 和 Keynote 静态预览器。

- `iwork-viewer`：可独立使用，不依赖 File Viewer。
- `@file-viewer/renderer-iwork`：用于接入 File Viewer 的薄适配包。
- 支持 iWork '09 XML/APXL 与 iWork 2013+ Snappy/IWA 容器。
- 在 Worker 中执行有界解析，支持中止、超时和资源上限。
- Numbers 显示文档保存的公式结果；Keynote 不执行动画、转场或视频播放。
- 加密 iwpv2 文件只做检测和明确报错，不在浏览器中解密。

当前仓库仅用于本地拆分验证，尚未创建公开远端或发布 npm 包。

## 独立使用

```ts
import { renderIworkDocument } from 'iwork-viewer'

const instance = await renderIworkDocument(buffer, document.querySelector('#viewer')!, 'pages')
instance.fit('width')

// 销毁并释放 Worker、Blob URL 与 DOM
instance.destroy()
```

## 接入 File Viewer

```ts
import iworkRenderer from '@file-viewer/renderer-iwork'

const viewer = createFileViewer({
  container,
  options: { renderers: [iworkRenderer] },
})
```

英文说明见 [README.en.md](./README.en.md)。
