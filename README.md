# Lucas AMC8 Coach v0.6.5.4

Lucas 的 AMC8 纸上训练与家长记录工具。


## v0.6.5.4 缓存修复（2026-10-23）

- 为 `coach_review_cycle_v065.js` 增加版本查询参数，避免浏览器复用旧脚本缓存。
- 版本号统一为 v0.6.5.4；本次不修改用户训练数据和 Supabase 表结构。
- 部署后仍需确认浏览器加载的新脚本已重建并保存复测队列。

## v0.6.5.3 复测队列修复（2026-10-23）

- 修复专项复测队列在处理“此前没有失败任务的正确作答”时可能把空任务写入队列的问题。
- 队列重建时只保存有效任务，并在生成任务列表时过滤空值，避免报告面板读取 `null.status` 时中断。
- 本次仅修改前端队列脚本和版本标记；未修改 Supabase 表结构，也未清空本地或云端训练数据。
- 代码级检查已完成；线上浏览器交互回归需待本次 GitHub Pages 部署完成后继续验证。

## v0.6.5.2 维护修复（2026-10-23）

- 同步页面标题、构建标记和内部 `ENGINE_VERSION` 到 v0.6.5.2。
- 提交周末25题时，家长明确选择“完整诊断”或“普通周末模拟”；选择结果写入 `paper_type`，供“四周诊断”页面识别。
- 本次不修改 Supabase schema，不清空本地或云端数据。浏览器端到端流程仍需实测后才能标记为最终验收通过。

## v0.6.3 核心变化

### 1. 停止自动使用旧 300 道生成题
v0.6.0–v0.6.2 的 300 道生成题保留在 `question_bank_legacy_v060.json`，仅用于解释历史作答记录，不再进入每日 3 题或周末 25 题的自动调度。

### 2. 真实 AMC8 题库成为出题核心
网页启动时从公开 GitHub 数据源加载 2015–2018 四年共 100 道真实 AMC8 题。

- 每日 3 题：默认只从 Q13–Q25 中选题；Q1–Q12 不再进入自动周中专项。
- Lucas 当前基线以正式题号位置校准：弱项迁移中心约 Q16，复测中心约 Q17，广度题约 Q20；周五可推进到 Q22–Q25。
- 第 3 题用于广度/陌生题型：通常取 Q19–Q22，周五重点取 Q22–Q25。
- 周末 25 题：第 n 题只从历年真实 AMC8 的第 n 题位置中抽取，保持真实考试难度曲线。

2019–2026 继续作为独立整套真题/近期真题资源，默认不混进 2015–2018 的日常池，避免提前泄题。

### 3. 每日锁卷
当天第一次生成 3 题后锁定题号和卷号。刷新、打印、提交、重新打开网页都不能换题。

### 4. 已知误录自动修复
v0.6.2 GitHub Pages 首次切换造成的 2026-10-21 三题错配，只在题号、答案、用时和 0/3 会话全部精确匹配时自动撤销。

### 5. Supabase 云同步底座
本地仍以 `localStorage` 为第一写入层；断网不影响记录。
绑定专用 Supabase 项目后支持：
- 邮箱注册/登录
- 自动同步
- 手动“本地→云”
- 手动“云→本地”
- 冲突检测，不静默覆盖

`cloud_config.js` 只应放 Supabase URL 与 publishable/anon key，绝不能放 service_role key。

## 数据源
真实 AMC8 结构化数据来自公开 GitHub 项目 `iuruoy-shao/training-problems`。
软件会在浏览器端加载并缓存 2015–2018 题目。

## 使用流程
1. 打开 GitHub Pages。
2. 每日训练页面打印当天 3 题。
3. Lucas 在纸上完成，家长录答案与单题时间。
4. 周末生成 25 题后锁卷，纸上完成，网页逐题录入。
5. Supabase 配置完成后登录即可跨设备同步。

## 文件
- `index.html`：主程序
- `cloud_config.js`：Supabase 公共配置
- `SUPABASE_SETUP.sql`：专用云库表与 RLS
- `question_bank.json`：v0.6.3 真实题库来源清单
- `question_bank_legacy_v060.json`：旧 300 道题，仅兼容历史记录
- `V063_VALIDATION.json`：本版验证结果


## 云端已绑定
- Supabase project: `lucas-amc8`
- Project ref: `dfwojiefseopguoqugzs`
- Region: Tokyo (`ap-northeast-1`)
- 表：`public.amc8_user_state`，RLS 已启用。
- 浏览器端仅使用 publishable key，不包含 service_role/secret key。
