该目录已内置 PaddleOCR-json Windows x64 运行时，用于扫描版 PDF 的本地 OCR 回退识别。

- 运行时版本：v1.4.1
- 可执行文件：`PaddleOCR-json.exe`
- 模型目录：`models/`
- 打包方式：electron-builder 通过 `extraResources` 将整个 `resources/ocr` 目录复制到安装包资源目录
- 运行时定位：主进程优先从应用资源目录定位此运行时，未命中时回退到开发环境下的本目录

附加材料：
- `THIRD_PARTY_NOTICES.md`：采用理由、来源与许可说明
- `LICENSE-APACHE-2.0.txt`：随运行时分发的 Apache 2.0 许可证文本
