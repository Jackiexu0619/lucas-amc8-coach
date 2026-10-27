# v0.6.5.25 界面验收：隔离浏览器

基线为待审查的学习报告 PR #15 提交 `dde253bf6d5f2648263e1e4657d5512fa00d6596`。本轮在该提交派生的独立分支截图；所有作答与卷号均由全新的 Playwright 浏览器上下文注入，未读取家庭浏览器、未请求生产云同步、未调用 DeepSeek。截图为真实 Chromium 页面，不是设计稿。

## 前后截图

每格均可打开改造前、改造后画面。三种宽度分别是桌面 1440px、平板 768px、手机 390px。

| 页面状态 | 1440px | 768px | 390px |
| --- | --- | --- | --- |
| 首页 | [前](qa_screenshots/v06525/before/1440-home.png) / [后](qa_screenshots/v06525/after/1440-home.png) | [前](qa_screenshots/v06525/before/768-home.png) / [后](qa_screenshots/v06525/after/768-home.png) | [前](qa_screenshots/v06525/before/390-home.png) / [后](qa_screenshots/v06525/after/390-home.png) |
| 每日训练录入 | [前](qa_screenshots/v06525/before/1440-daily-entry.png) / [后](qa_screenshots/v06525/after/1440-daily-entry.png) | [前](qa_screenshots/v06525/before/768-daily-entry.png) / [后](qa_screenshots/v06525/after/768-daily-entry.png) | [前](qa_screenshots/v06525/before/390-daily-entry.png) / [后](qa_screenshots/v06525/after/390-daily-entry.png) |
| 第一题录入控件 | [前](qa_screenshots/v06525/before/1440-daily-form.png) / [后](qa_screenshots/v06525/after/1440-daily-form.png) | [前](qa_screenshots/v06525/before/768-daily-form.png) / [后](qa_screenshots/v06525/after/768-daily-form.png) | [前](qa_screenshots/v06525/before/390-daily-form.png) / [后](qa_screenshots/v06525/after/390-daily-form.png) |
| 报告分类与日期筛选 | [前](qa_screenshots/v06525/before/1440-report-categories.png) / [后](qa_screenshots/v06525/after/1440-report-categories.png) | [前](qa_screenshots/v06525/before/768-report-categories.png) / [后](qa_screenshots/v06525/after/768-report-categories.png) | [前](qa_screenshots/v06525/before/390-report-categories.png) / [后](qa_screenshots/v06525/after/390-report-categories.png) |
| 日期与卷号展开 | [前](qa_screenshots/v06525/before/1440-report-archive.png) / [后](qa_screenshots/v06525/after/1440-report-archive.png) | [前](qa_screenshots/v06525/before/768-report-archive.png) / [后](qa_screenshots/v06525/after/768-report-archive.png) | [前](qa_screenshots/v06525/before/390-report-archive.png) / [后](qa_screenshots/v06525/after/390-report-archive.png) |
| 2002 Q20 原题与作答 | [前](qa_screenshots/v06525/before/1440-report-question.png) / [后](qa_screenshots/v06525/after/1440-report-question.png) | [前](qa_screenshots/v06525/before/768-report-question.png) / [后](qa_screenshots/v06525/after/768-report-question.png) | [前](qa_screenshots/v06525/before/390-report-question.png) / [后](qa_screenshots/v06525/after/390-report-question.png) |
| 2015 Q1 原题与已有解析 | [前](qa_screenshots/v06525/before/1440-report-solution.png) / [后](qa_screenshots/v06525/after/1440-report-solution.png) | [前](qa_screenshots/v06525/before/768-report-solution.png) / [后](qa_screenshots/v06525/after/768-report-solution.png) | [前](qa_screenshots/v06525/before/390-report-solution.png) / [后](qa_screenshots/v06525/after/390-report-solution.png) |
| 周末模拟报告 | [前](qa_screenshots/v06525/before/1440-mock-report.png) / [后](qa_screenshots/v06525/after/1440-mock-report.png) | [前](qa_screenshots/v06525/before/768-mock-report.png) / [后](qa_screenshots/v06525/after/768-mock-report.png) | [前](qa_screenshots/v06525/before/390-mock-report.png) / [后](qa_screenshots/v06525/after/390-mock-report.png) |
| 家长设置 | [前](qa_screenshots/v06525/before/1440-parent-settings.png) / [后](qa_screenshots/v06525/after/1440-parent-settings.png) | [前](qa_screenshots/v06525/before/768-parent-settings.png) / [后](qa_screenshots/v06525/after/768-parent-settings.png) | [前](qa_screenshots/v06525/before/390-parent-settings.png) / [后](qa_screenshots/v06525/after/390-parent-settings.png) |

## 视觉与交互结果

- PASS：54 张真实浏览器截图；各状态均无页面横向溢出或未捕获的 JavaScript 异常。主导航与报告分类按钮的矩形未重叠。
- PASS：2002 Q20 原图解码且显示比例与源图一致；手机端点击“原题大图”可在新标签页打开实际 WebP。图片故障夹具显示可核对的错误提示，并移除失效的大图链接。2015 Q1 读取既有解法，解析容器无横向溢出；截图人工检查了题干、公式、选项和按钮。
- PASS：首页、每日录入、四类报告、日期筛选、卷号、作答、已有解析及周末 25 题报告沿用原有数据。键盘可聚焦“跳到主要内容”；分类仍支持方向键。
- PASS：正文与白色卡片对比度 14.45:1，次要正文与白卡片 6.04:1，白字与主按钮蓝色 6.78:1。按钮最小高度 44px；减少动态效果的系统设置会关闭过渡。
- 功能回归在独立报告测试及既有 12 项脚本中另行验证。以上截图与静态检查均不能替代部署后的家庭浏览器验收。

## Web Design Guidelines 审核

按 [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) 审核本轮修改。已落实跳转主内容、标签与状态、可见键盘焦点、44px 触控目标、真实图片替代占位图、长卷号换行、系统减少动态效果、数字表格等宽及明确的空数据状态。

保留的审核发现：

- `index.html:328-333` — 主导航仍以按钮与原有 `show()` 切换原生单页视图；页面状态没有对应的 URL 深链接。
- `index.html:1835` — 原题图片没有统一的 HTML 宽高属性。575 张 WebP 的实际宽高比不同；写死同一比例会误导留白尺寸，未来可在独立资源索引中逐图提供原生尺寸。
- `index.html:2015-2019` — 日期筛选保留在当前页面内存，不写入 URL；与现有报告筛选行为一致。

这些是 Web Design Guidelines 的未关闭建议，不属于本轮学习报告渲染故障。改造导航路由或逐图尺寸索引应另行评估回退与打印影响；本轮没有据此改动学习数据或组卷逻辑。

## 重现方法

在隔离工作树设置 `AMC8_UI_CAPTURE_DIR` 后运行 `node qa_ui_capture_v06525.cjs`。设置 `AMC8_UI_SOURCE_DIR` 可对另一独立 checkout 截取同样测试夹具的页面。脚本拦截 Supabase 同步与 AI 讲解请求；它不保存作答。
