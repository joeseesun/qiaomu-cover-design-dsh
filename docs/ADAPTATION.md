# 乔木封面 DSH：迁移与验收

2026-10-27。来源为 [qiaomu-cover-design](https://github.com/joeseesun/qiaomu-cover-design) `c56bb742eecc0c9f6bbd419c598060aa99d5410f`（0.3.3，MIT）。原工作区及其未提交内容保持不变。

## UI 与宿主

直接复用 `src/original` 中的原版画布、面板、设置、弹窗、图库、字体、模型接入、布局、素材和业务模块。原 `styles.css` SHA256：`f847cddbee0fc5f32abda80d10b30509a3aff00cbf2eea43e54b97b2e05748f4`，保持字节一致。新代码只承担 Harness Slot/Remote、原生 DOM 控件边界、文件与凭据、主题和生命周期。

原 `main.ts` 仅保留为来源参考，不打包、不运行 Obsidian Plugin。入口是 Cordis Host service 与 Client panel；没有导入 Obsidian 运行时。原 AI 设计面板是画布动作入口，保留其选择范围、执行前验证、历史与撤销语义。

## 完整功能对照

| 原能力 | DSH 实现 | 验证证据 |
| --- | --- | --- |
| 工程与笔记 | 原 `.qcover` 格式，多标签、来源笔记、选段/全文、自动保存、冲突恢复 | 实测导入 Markdown、从笔记创建工程、重载恢复；CAS/编辑快照/恢复文件测试 |
| 画布基本操作 | 原 CoverView/scene/marquee，选择、拖拽、缩放、对齐、参考线、安全区、撤销重做 | 实测文字编辑、撤销/重做、选中图像、面板往返；原 snapping/marquee 测试 |
| 图层 | 原面板、搜索、排序、锁/隐藏、改名、复制、编组、右键菜单 | 实测图层隐藏/撤销及属性选择；原业务未替换 |
| 排版与颜色 | 原 textstyles/typeset/color/mesh 与字体浏览器 | 全模板真实 canvas 排版检查，原颜色/布局/文字测试，编辑运行验收 |
| 图像编辑与绘制 | 原 drawing/cutout、裁剪/圆角/翻转/选区导出与局部 AI 编辑 | 原画笔/对象约束/图像任务测试，实际图片插入；未用硬件笔验证压力 |
| 模板与平台 | 46 模板、12 平台，原重排、A/B 变体与最多 6 个系列 | 所有公共形状真实 canvas 布局规则通过；实测模板新建 |
| 字体与素材 | 原 74 字体目录、34 默认字库、字体包、配对、导入、系统字体/Lucide/Emoji | 34/34 文件长度及 SHA 验证，实际字体设置；系统字体授权取决于宿主 |
| 图库 | 原上传/生成/本机目录/Unsplash、筛选、搜索、改名、删除 | 上传、改名、确认删除、本机目录列表实测；原图库存储测试；未调用真实 Unsplash |
| AI 排版与聊天 | 原 planner/designflow/compose、选择约束、候选、聊天历史/重试/分支 | 本地 OpenAI fixture 实际修改标题并保存；选中图像时拒绝越界改标题；原聊天/计划/选择测试 |
| AI 图片任务 | 原多服务生成/参考图/任务持久化/预览后插入/过期选择保护 | 实际 fixture 请求→结果→插入；切到 Home 时任务继续完成，重开图库可取回；原任务恢复测试 |
| 导出 | 原 PNG/JPG/WebP、倍率/质量/体积、选区、目录/命名、插入/属性/剪贴板 | PNG 2160×2880、JPEG 1080×1440、WebP 3240×4320 实际文件；正文及 cover 写回；系统目录独占写入测试 |
| 模型与账号 | 原模型接入、配置、Codex/ChatGPT/OpenRouter 等协议，Host 网络与系统凭据 | 原模型/协议测试；真实本机 HTTP OAuth state/cancel、假 Codex 子进程模型/文本/图像/取消；不宣称真实账号登录 |
| 设置与迁移 | 原五页设置；显式复制工程/目录/附件，旧 data.json，原宿主账号重新连接 | 实际导入设置、字体、模型界面；凭据隔离/回滚与工作区测试 |
| Home 与快捷键 | 原 Home provider 适配 Cordis，最近工程/新建/搜索、原画布快捷键与 Harness 命令 | provider/入口构建检查，日常公开包安装后补充实际运行记录 |

## 验收状态

- 本地 `npm run check`：152 项通过、0 跳过，包括来源的 141 项业务测试与 native canvas 模板排版；CI 强制 `canvas` 可加载。
- 隔离 Harness `ports-qa`：原版编辑器、设置、图库、导出及上述核心工作流已运行。截图来自真实 Harness，见 `screenshots/`。
- 支持深浅主题。720×900 验证原窄屏面板与收起后的画布，截图在 ResizeObserver/渲染帧稳定后记录。
- 面板切换回归：旧版在根节点离开 DOM 时仍计算缩放，产生 NaN 平移量而白屏；现在跳过断开或无尺寸的画布。连续三次往返像素结果一致。
- 后台生成的 controller 生命周期归 Cordis 插件，不归 React 面板；切换面板不丢弃队列。插件卸载清理视图、请求和登录回调。
- 测试模型地址与专用 Keychain 测试凭据已清理。用户原 Obsidian 数据没有改写。
- GitHub PR/CI/Release、匿名下载、公开包独立安装和日常桌面安装分别记录，不能由本地通过推定已发布。

## 边界与数据

工作区文件只允许规范相对路径，不跟随软链接，单文件 64 MB；工程删除移入 `.trash`。系统目录和本机图库由用户明确选择，导出重名自动编号。`notesDir`/`dataDir` 是绝对路径配置。原生桌面目录选择器由 Harness 提供；浏览器端复用原小弹窗控件输入宿主绝对路径。

密钥用 macOS Keychain / Windows DPAPI / Linux Secret Service。账户回调、Codex 子进程和文件网络操作放在 Host。DeepSeek 请求只接受 `deepseek-flash`。网络响应有体积/超时限制，跨源重定向不转发认证。模型 SSE 保留原 buffered fallback，远端完成后交还原解析器。

未验证：付费供应商实际生成、真实账号登录、Unsplash 账户、Windows/Linux 实机凭据、物理手机/触控笔、其他 Harness 大版本。上述路径保留实现及原测试，不把 fixture 结果写成真实服务验收。
