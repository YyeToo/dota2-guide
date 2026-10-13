# Issue 跟踪：GitHub

本仓库的 issue 和 spec 都存放在 GitHub Issues，所有操作一律通过 `gh` CLI 完成。

## 约定

- **建 issue**：`gh issue create --title "..." --body "..."`。多行 body 用 heredoc。
- **读 issue**：`gh issue view <number> --comments`，配合 `jq` 过滤评论，并取出 labels。
- **列 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需加 `--label` / `--state` 过滤。
- **评论**：`gh issue comment <number> --body "..."`
- **加 / 去标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

仓库由 `git remote -v` 推断；在仓库目录内执行时 `gh` 会自动识别，无需手动传 `--repo`。

## 把 PR 当作请求入口

**PR 作为请求入口：否**（若本仓库把外部 PR 也当需求处理，改成 `yes`；`/triage` 会读这一行。）

当它为 `yes` 时，PR 走与 issue 完全相同的标签和状态机，命令换成 `gh pr` 版本：

- **读 PR**：`gh pr view <number> --comments`，diff 用 `gh pr diff <number>`。
- **列待 triage 的外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，只保留 `authorAssociation` 为 `CONTRIBUTOR` / `FIRST_TIME_CONTRIBUTOR` / `NONE` 的（丢掉 `OWNER` / `MEMBER` / `COLLABORATOR`）。
- **评论 / 打标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label` / `--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共用一个编号空间，所以裸写的 `#42` 可能是两者之一：先 `gh pr view 42`，失败再回退到 `gh issue view 42`。

## 当技能说"发布到 issue tracker"

建一个 GitHub issue。

## 当技能说"取出对应工单"

执行 `gh issue view <number> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。**地图（map）** 是一个 issue，**子工单** 是它的子 issue。

- **地图**：单个 issue，标签 `wayfinder:map`，body 里放 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **子工单**：作为 GitHub 原生 sub-issue 挂到地图下（`gh api` 调 sub-issues 接口）。若仓库未启用 sub-issues，就退化为：在地图 body 里加一条任务清单，并在子工单 body 顶部写 `Part of #<map>`。标签 `wayfinder:<type>`（`research` / `prototype` / `grilling` / `task`）。被认领后指给对应开发者。
- **阻塞**：用 GitHub 原生 issue dependencies，这是最规范、UI 可见的表达。用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 加边，其中 `<blocker-db-id>` 是阻塞者的**数据库数字 id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，**不是** `#number`，也不是 `node_id`）。GitHub 用 `issue_dependencies_summary.blocked_by` 汇报（只算未关闭的阻塞者，这才是实时判据）。若仓库不支持 dependencies，回退为在子工单 body 顶部写 `Blocked by: #<n>, #<n>`。所有阻塞者都关闭时，该工单即解除阻塞。
- **前沿（frontier）查询**：列出地图下所有未关闭子工单（`gh issue list --state open`，限定到该地图的 sub-issues / 任务清单），剔除有未关闭阻塞者（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行里还有未关闭 issue）的、以及已指派的；地图顺序里最靠前的胜出。
- **认领**：`gh issue edit <n> --add-assignee @me`，这是整个会话的第一次写操作。
- **解决**：`gh issue comment <n> --body "<答案>"`，然后 `gh issue close <n>`，最后往地图的 Decisions-so-far 追加一条上下文指针（要点 + 链接）。
