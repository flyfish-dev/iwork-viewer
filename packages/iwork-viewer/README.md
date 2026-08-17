# iwork-viewer

浏览器原生、离线优先的 Apple Pages、Numbers 和 Keynote 静态预览器，不依赖 File Viewer、服务端转换或运行时 CDN。

```bash
pnpm add iwork-viewer@0.0.1
```

```ts
import { renderIworkDocument } from 'iwork-viewer'

const viewer = await renderIworkDocument(buffer, document.querySelector('#viewer')!, 'pages')
viewer.fit('width')
viewer.destroy()
```

支持 iWork '09 XML/APXL 与现代 Snappy/IWA 容器。Numbers 显示文件保存的公式结果；Keynote 动画、转场和视频保持静态；加密 iwpv2 仅检测，不在浏览器中解密。

完整兼容范围、fixtures、视觉门禁和英文文档见 [GitHub](https://github.com/flyfish-dev/iwork-viewer)。
