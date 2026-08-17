# iWork Viewer

浏览器原生、离线优先的 Apple Pages、Numbers 和 Keynote 静态预览器。

- `iwork-viewer`：可独立使用，不依赖 File Viewer。
- `@file-viewer/renderer-iwork`：用于接入 File Viewer 的薄适配包。
- 支持 iWork '09 XML/APXL 与 iWork 2013+ Snappy/IWA 容器。
- 在 Worker 中执行有界解析，支持中止、超时和资源上限。
- Numbers 显示文档保存的公式结果；Keynote 不执行动画、转场或视频播放。
- 加密 iwpv2 文件只做检测和明确报错，不在浏览器中解密。

项目采用双包边界：独立预览器不依赖 File Viewer，适配包只负责接入 File Viewer 的 renderer 契约。两个包都保持浏览器原生、离线可用，不依赖服务端转换或运行时 CDN。

## 安装

独立使用：

```bash
pnpm add iwork-viewer@0.0.2
```

接入 File Viewer：

```bash
pnpm add @file-viewer/core@^2.3.0 @file-viewer/renderer-iwork@0.0.2
```

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

## 支持边界

- Pages：分页与页面布局、文本、图片、形状、表格、图表和样式。
- Numbers：多工作表自由画布、多个表格、保存的公式结果、数字格式、图片、形状和图表。
- Keynote：幻灯片、母版背景、文本、图片、形状、表格、图表和演讲者备注。
- 不执行 Keynote 动画、转场和视频播放；不重新计算 Numbers 公式。
- 加密 iwpv2 只做可靠检测；未知 IWA 对象图仅作为有限预览，不计入高保真证据。

## 开发验证

```bash
pnpm install --frozen-lockfile
pnpm verify
```

真实 Apple fixtures、来源与 SHA-256 位于 `test/fixtures/manifest.json`；视觉基线位于 `test/goldens/`。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告。

英文说明见 [README.en.md](./README.en.md)。
