# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略

- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

前端构建、测试与预览命令
- Date: 2026-10-20
- Context: Agent 在验证 Luma 照片管家前端时发现
- Category: 构建方法
- Instructions:
  - 生产构建：`npm run build`（内部为 `tsc -b && vite build`，产物在 `dist/`）
  - 单元测试：`npx vitest run`（测试文件位于 `src/lib/*.test.ts`）
  - 线上预览：`npx vite preview --host 0.0.0.0 --port 4173`，服务的是 `dist/` 生产包
  - 预览务必使用生产包而非 `npm run dev`：容器内存有限，dev 模式编译/热重载内存峰值高，易触发 OOM

浏览器端 UI 校验工具链
- Date: 2026-10-20
- Context: Agent 在无法直接查看截图的情况下做界面回归时发现
- Category: 环境配置
- Instructions:
  - 本环境无可用画布/图像处理库，界面校验依赖 Playwright
  - playwright 为全局 CommonJS 包，需用绝对路径引入：`import pkg from '/usr/local/lib/node_modules/playwright/index.js'`
  - 首次安装浏览器需设置镜像：`PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright`，并执行 `playwright install-deps chromium`
  - 截图脚本模板：viewport 390x844、isMobile、hasTouch，并收集 console error 与 pageerror

等待异步分析完成的正确姿势
- Date: 2026-10-20
- Context: Agent 在自动化测试中等待照片分析完成时发现
- Category: 排错调试
- Instructions:
  - 不要用 `waitForSelector(state: 'detached')` 等待进度条消失：元素尚未出现时该条件立即成立，会产生竞态导致过早断言
  - 正确做法：在 Node 侧轮询 IndexedDB（读取 `photos` store，判断 `analyzed` 数量）直到全部完成
  - 用 `page.evaluate` 读取应用数据（如 IndexedDB）比解析 DOM 更可靠

云端模型服务与密钥管理
- Date: 2026-10-20
- Context: Agent 在接入 COSMO 云端模型（描述/归类/点评/语义搜索）时发现
- Category: 运维部署
- Instructions:
  - 密钥只写在仓库根目录 `.env`（已被 `.gitignore` 忽略），前端永不接触密钥；`.env.example` 存占位值
  - 后端为 `server/index.mjs`（Node 内置 http，无第三方依赖），默认监听 8787，提供 `/api/health`、`/api/vision`、`/api/text`、`/api/embeddings`、`/api/rerank`
  - 一键同时起后端与预览：`npm run serve`（= `server/serve.mjs`，内含 vite preview 4173 + api 8787）；单独起后端用 `npm run api`
  - `vite.config.ts` 的 `server.proxy` 与 `preview.proxy` 均把 `/api` 转发到 `http://127.0.0.1:8787`，对外只暴露 4173 一个端口
  - 修改 `.env` 或服务端代码后必须重启 `npm run serve`；仅改前端只需 `npm run build`（vite preview 按请求读 dist，无需重启）

上游网关配额与批量调用
- Date: 2026-10-20
- Context: Agent 在压测 `https://gpt.cosmoplat.com/v1` 时发现
- Category: 排错调试
- Instructions:
  - 该网关有每分钟约 20 次的调用配额，超出后返回 429（错误信息为「云端模型调用配额已满」）
  - 因此批量任务必须合并请求：视觉接口 `/api/vision` 单次可传多张图（客户端按 4 张一批），向量接口 `/api/embeddings` 单次可传多条文本（客户端按 32 条一批）
  - 客户端 `src/lib/cloud.ts` 的 `withRetry` 对 429/502/503 做指数退避重试，遇到 429 不要直接报错
  - 实测模型：`cosmo-mind-vl` 实为 qwen3-vl-235b-awq，`cosmo-mind-emb` 为 bge-large-zh-v1.5（1024 维），`cosmo-mind-rerank` 为 cohere 风格 `/rerank`

检索信号的实测特性（调阈值前必读）
- Date: 2026-10-20
- Context: Agent 在调优图库「语义 + 关键词」融合检索、反复出现召回或精度问题时实测发现
- Category: 排错调试
- Instructions:
  - 两路语义信号分工不同：bge 余弦适合判断「是否相关」（相关约 0.55-0.67，无关 0.23-0.38），重排 `relevance_score` 适合判断「谁更相关」
  - 重排分数的绝对量级随查询剧烈波动：同一张确实相关的照片，某查询下 0.99、另一查询下仅 0.03；但同一查询内相关样本比无关样本高 1-2 个数量级 → 只能用「相对阈值」比较，不能设绝对分数线
  - 因此设计为：余弦窗口 + 查询级置信度决定「准入」，重排决定「排序」；重排本身失效（最高分 < 0.01）时退回余弦排序
  - 查询完全无匹配时（如「宇宙飞船」）余弦最高分只有 0.31 且无词法命中，据此判定「没有匹配」而非靠阈值过滤结果
  - 排错手法：用 Playwright 监听 `/api/*` 响应，直接打印 `keywords`/`albums`/重排 top 分数，比猜测阈值快得多
  - 长查询链连打会触发网关限流导致 `/api/text` 长时间挂起，此时界面仍在「正在检索」；自动化断言必须先等检索落地（等待提示文案不含「正在检索」）再取结果

文档 HTML 生成链路
- Date: 2026-10-20
- Context: Agent 在把产品说明 Markdown 转成可直接浏览的 HTML 时发现
- Category: 构建方法
- Instructions:
  - `npm run docs:html` 调用 `tools/build-doc-html.mjs`（零依赖），默认读 `.cosmocode/docs/产品说明.md` 并就地生成同名 `.html`
  - 图片按相对路径 `assets/` 引用，因此 HTML 必须与 `assets/` 同目录；换目录生成时需同步拷贝截图
  - 截图是 780x1688（390x844 @2x）的移动端视口，桌面端截图为 1920x1350
  - 页面图片为 `loading="lazy"`，Playwright 校验前要分段滚动（每次约 0.7 屏）而非直接跳到底部，否则中部图片不触发加载、`img.complete` 永久为 false
  - 生成器只覆盖本仓库用到的语法（标题、表格、图片、列表、引用、行内加粗与代码），新增 Markdown 语法前先补解析分支

版本号注入约定
- Date: 2026-10-20
- Context: Agent 在新增「版本说明」入口并避免版本号两处维护时发现
- Category: 构建方法
- Instructions:
  - `package.json` 的 `version` 是唯一来源，`vite.config.ts` 通过 `define.__APP_VERSION__` 注入，源码里用 `src/lib/version.ts` 的 `APP_VERSION` 读取
  - `tsconfig.app.json` 不含 node 类型，`src/vite-env.d.ts` 负责声明 `__APP_VERSION__`
  - 新增发布说明只改 `src/lib/version.ts` 的 `RELEASE_NOTES`，并保持首条版本号等于 `package.json` 的 version（`version.test.ts` 会校验）
