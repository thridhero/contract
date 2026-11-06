# PaddleOCR-json 内置运行时说明

## 采用结论
- 当前项目默认内置 `PaddleOCR-json` 作为扫描版 PDF 的本地 OCR 运行时。
- 采用原因是其以 Windows 可执行文件形式分发，更适合当前 Electron 桌面应用的离线打包、内置分发与主进程调用方式。
- 运行时已直接放入 `resources/ocr/PaddleOCR-json`，安装包会随应用一并分发，不要求用户另行下载或手动配置路径。

## 版本与来源
- 运行时名称：`PaddleOCR-json`
- 运行时版本：`v1.4.1`
- 发行资产：`PaddleOCR-json_v1.4.1_windows_x64.7z`
- 上游仓库：`https://github.com/hiroi-sora/PaddleOCR-json`
- 上游发行页：`https://github.com/hiroi-sora/PaddleOCR-json/releases/tag/v1.4.1`

## 许可说明
- `PaddleOCR-json` 上游仓库许可证：Apache License 2.0
- `PaddleOCR` 上游仓库许可证：Apache License 2.0
- 本目录附带 `LICENSE-APACHE-2.0.txt` 作为随运行时分发的许可证文本

## 分发内容
- `PaddleOCR-json.exe`
- OCR 运行所需 DLL
- `models/` 下的检测、分类、识别模型与配置文件
- `version.txt`

## 集成边界
- 本项目仅将该运行时作为本地 OCR 引擎嵌入软件资源目录，并通过主进程调用其可执行文件完成页面识别。
- OCR 结果会生成受应用管理的 Markdown 缓存文件，用于全文索引与 AI 文档读取复用。
