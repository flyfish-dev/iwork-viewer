<div align="center">
  <img src="https://github.com/flyfish-dev/iwork-viewer/releases/download/v0.0.2/iwork-viewer-logo.png" width="104" height="104" alt="iWork Viewer logo" />
  <h1>iWork Viewer</h1>
  <p>浏览器原生、离线优先的 Apple Pages、Numbers 和 Keynote 静态预览器。</p>
  <p><a href="./README.md">English</a> · 简体中文</p>
</div>

`iwork-viewer` 可以独立使用，不依赖 File Viewer；`@file-viewer/renderer-iwork` 是接入 File Viewer 的薄适配包。两个包均在浏览器中完成处理，不依赖服务端转换、运行时 CDN 或第三方文档上传。

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

const target = document.querySelector<HTMLDivElement>('#viewer')
if (!target) throw new Error('Missing #viewer')

const instance = await renderIworkDocument(file, target, 'pages')
instance.fit('width')

// 销毁并释放 Worker、Blob URL 与 DOM
instance.destroy()
```

## 支持范围

- Pages：分页与页面布局、文本、图片、形状、表格、图表和样式。
- Numbers：多工作表自由画布、多个表格、保存的公式结果、数字格式、图片、形状和图表。
- Keynote：幻灯片、母版背景、文本、图片、形状、表格、图表和演讲者备注。
- 支持 iWork '09 XML/APXL 与 iWork 2013+ Snappy/IWA 容器。
- 不执行 Keynote 动画、转场或视频；不重新计算 Numbers 公式。
- 加密 iwpv2 文件只做可靠检测，不在浏览器中解密。

## 开发验证

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:visual
```

真实 fixture 的来源和 SHA-256 位于 `test/fixtures/manifest.json`，视觉基线位于 `test/goldens/`。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告。
