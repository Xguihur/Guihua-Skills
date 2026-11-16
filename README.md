# Guihua Skills

常用 Codex skills 合集。通用工作流保存在仓库，本机路径配置留在使用者的配置目录。

## Skills

| Skill | 用途 |
| --- | --- |
| [spec-workflow](skills/spec-workflow/SKILL.md) | 新需求与 bug 修复默认先制定 spec，保留 SDD、行为/接口契约、TDD 和测试基线 |

## 安装

将需要的 skill 目录复制到 `$CODEX_HOME/skills/`；未设置 CODEX_HOME 时使用 `~/.codex/skills/`。例如将 `skills/spec-workflow` 整个目录复制到 `~/.codex/skills/spec-workflow`。

可显式调用 `$spec-workflow`。该 skill 也允许自动匹配需求规划和 bug 修复请求；自动选择取决于宿主环境，若项目需要固定执行约定，可在项目指令中引用它。

## Spec 输出目录配置

将 [配置示例](skills/spec-workflow/references/config.example.json) 复制到 `$CODEX_HOME/spec-workflow.json`，未设置 CODEX_HOME 时使用 `~/.codex/spec-workflow.json`，将 `specRoot` 改为本机绝对路径。

- `specRoot`：默认保存根目录。
- `projectFolders`：项目名与根目录内相对目录的映射。
- 未配置路径时先询问，禁止默认把文档写进项目仓库。
- 当前用户明确指定的位置优先；一次性指定不会自动改写持久配置。
- 本机路径配置不纳入本仓库。

## 维护

修改仓库中的 skill 后，验证并同步到本机安装目录。不要将用户 spec、密钥或本机配置提交到合集。
