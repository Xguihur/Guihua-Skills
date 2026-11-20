# Guihua Skills

常用 Codex 和 OMP Skills 合集。仓库保存通用工作流，本机配置通过 Git 忽略规则保留在本地。

## Skills

| Skill | 用途 |
| --- | --- |
| [spec-workflow](skills/spec-workflow/SKILL.md) | 新需求与 bug 修复默认先制定 spec，保留 SDD、行为/接口契约、TDD 和测试基线 |
| [zentao-my-bugs](skills/zentao-my-bugs/SKILL.md) | 查询禅道指派给当前账号的 Bug 数量、列表和指定 Bug 详情 |
| [work-review](skills/work-review/SKILL.md) | 汇总禅道、GitLab 和 Obsidian 工作记录，生成并归档个人周复盘或月度复盘 |

## 安装

将需要的 skill 目录复制到 `$CODEX_HOME/skills/`；未设置 CODEX_HOME 时使用 `~/.codex/skills/`。例如将 `skills/spec-workflow` 整个目录复制到 `~/.codex/skills/spec-workflow`。

可显式调用 `$spec-workflow`。该 skill 也允许自动匹配需求规划和 bug 修复请求；自动选择取决于宿主环境，若项目需要固定执行约定，可在项目指令中引用它。

Codex 和 OMP 可以共用 `~/.agents/skills/`。安装 `zentao-my-bugs` 时，将该目录下的同名入口链接到仓库中的 `skills/zentao-my-bugs`，以便技能和本机配置使用同一处文件。配置与登录步骤见技能说明。

安装 `work-review` 时，将 `~/.agents/skills/work-review` 链接到仓库中的 `skills/work-review`。将[配置示例](skills/work-review/config.example.json)复制成同目录的 `work-review.local.json`，填写 vault 绝对路径及各子目录的相对路径。`chatNotesDirectory` 可设为 `null`。确认 OMP Chatbot 能访问 vault 和已有查询工具后，可用「复盘上周」起草，再用「归档这次复盘」保存。

## Spec 输出目录配置

将 [配置示例](skills/spec-workflow/references/config.example.json) 复制到 `$CODEX_HOME/spec-workflow.json`，未设置 CODEX_HOME 时使用 `~/.codex/spec-workflow.json`，将 `specRoot` 改为本机绝对路径。

- `specRoot`：默认保存根目录。
- `projectFolders`：项目名与根目录内相对目录的映射。
- 未配置路径时先询问，禁止默认把文档写进项目仓库。
- 当前用户明确指定的位置优先；一次性指定不会自动改写持久配置。
- 本机路径配置不纳入本仓库。

## 维护

修改仓库中的 skill 后，验证并同步到本机安装目录。不要将用户 spec、密钥或本机配置提交到合集。
