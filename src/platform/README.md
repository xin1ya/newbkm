# src/platform/

**职责**：平台抽象：存档、资源读取、全屏、退出。`web/` 为浏览器实现，以后新增 `tauri/`

**相关任务**：ENG-005

**依赖规则**：除本目录外，禁止直接使用 localStorage / indexedDB / window.close

> 导航总表见 [docs/00-MASTER-CONTROL.md §4](/docs/00-MASTER-CONTROL.md)。
