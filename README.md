# 乔木封面 · DeepSeek Harness

> v0.1.2：DeepSeek Harness **0.2.1-rc.3** 兼容更新。[本次验证范围](docs/RC3-COMPATIBILITY.md)。

[English](README.en.md)

把想法、笔记和图片做成封面。在 DeepSeek Harness 中直接使用乔木封面原版画布、图层、字体、模板、AI 设计面板和导出窗口。

![原版封面工作台](docs/screenshots/original-editor.png)

## 功能

- 原版 Fabric 画布：文字、形状、图片、自由画笔、图层、组合、对齐、网格、安全区、撤销与重做。
- 46 个模板、12 种发布尺寸，保留 A/B 变体、风格系列、排版与配色工具。
- 34 款默认字体自动下载并校验；74 款字体目录、可选字体包、本地字体导入、图标与素材。
- 多个 `.qcover` 工程与 Markdown 来源笔记，自动保存、冲突保护、重新打开时恢复标签页。
- 原版 AI 设计对话、局部修改、历史、分支画布与多服务模型设置；图像任务切换面板后继续运行，结果保留在图库。
- 上传图片、本机目录、生成结果和 Unsplash 图库；搜索、筛选、重命名和删除。
- PNG、JPG、WebP，1/2/3 倍、质量与体积控制、透明选区；可导出到工作区、来源笔记目录或系统目录，插入笔记并写入 `cover` 属性。
- Home 最近工程与新建入口、原快捷键、中文/英文界面和深浅主题。

![原版字体设置](docs/screenshots/original-fonts.png)

## 安装与开始

要求 DeepSeek Harness `0.2.1-rc.3`、Node.js 22 或更新。

从 [Releases](https://github.com/joeseesun/qiaomu-cover-design-dsh/releases) 下载 tgz 和 SHA256SUMS，校验后在插件管理安装，或运行：

```sh
dsh plugin --profile desktop add /absolute/path/qiaomu-cover-design-dsh-0.1.2.tgz
```

侧栏打开「乔木封面」，顶部「更多 → 新建封面」，填写标题并选择原版模板。选中文字在右侧调整字体、颜色与排版，点击「导出」保存。窄窗口下用左上角按钮收起 AI 面板即可查看画布。

## 原版数据迁移

「更多」提供工程/笔记/附件导入、工作区文件夹导入和原 `data.json` 设置导入。目录导入保留相对结构，重名文件另存编号；原文件不修改。请一并导入工程引用的来源笔记、图片与字体。单文件上限 64 MB。

默认工作区在 `$DSH_HOME/qiaomu/qiaomu-cover-design-dsh/workspace`（未设置 DSH_HOME 时使用 `~/.dsh`）。`notesDir` 可指定明确选择的工作区绝对路径，`dataDir` 指定状态目录。字体、图库和任务缓存放在工作区的 `QiaomuCoverData`；删除工程进入 `.trash`。

API 密钥写入 macOS Keychain、Windows DPAPI 或 Linux Secret Service，状态 JSON 只保留凭据引用。Linux 需要 `secret-tool` 和可用的 Secret Service。原宿主账号授权需重新连接。设置「模型与服务」保留原版多服务接入；DeepSeek 使用 `deepseek-flash`。使用 Codex 连接需要安装其 CLI。AI 服务可能收费，由你配置并触发。

桌面端选择系统目录使用 Harness 目录选择器；浏览器端填写运行 Harness 的电脑上的绝对路径。系统字体读取与剪贴板依赖宿主授权。Unsplash 需要自己的接入配置和相应图片许可。

## 验证与开发

152 项测试覆盖原业务、模板排版、生成任务、OAuth/Codex 协议、文件冲突、凭据、路径与网络边界。在独立 Harness profile 实测编辑、撤销、笔记写回、三种图片格式、后台生成、本地图库、字体、深浅色和 720 像素窗口。

AI 生成/排版与登录协议使用本地 fixture 验证，没有调用付费模型或登录真实服务；Windows/Linux 凭据及手机触控未做实机验证。详见 [迁移与验收对照](docs/ADAPTATION.md)。

```sh
npm ci
npm run check
npm pack
```

测试模板排版需要 `canvas` 原生依赖；CI 会确认该依赖可用，不以跳过测试替代通过。

MIT。原版 [qiaomu-cover-design](https://github.com/joeseesun/qiaomu-cover-design) 冻结基线 `c56bb742eecc0c9f6bbd419c598060aa99d5410f`。原 CSS 保持一致，宿主容器、文件、网络、凭据和生命周期单独适配。依赖及资源许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
