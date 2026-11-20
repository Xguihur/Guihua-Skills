# 读取 Logseq 日记

此流程适用于 Logseq DB 图谱。`work-review.local.json` 中配置可选的 `logseq.rootDir` 和 `logseq.graph`。`rootDir` 是包含 `graphs` 子目录的 CLI 根目录，`graph` 是 Logseq 中显示的名称。首次定位时可以用 `logseq graph list --root-dir <根目录> --output json` 核对图谱名。

## 按日读取

下面是 PowerShell 示例。使用本机配置里的根目录和图谱名，并将 `$journalDay` 改为北京时间目标日对应的 `YYYYMMDD` 整数。周复盘只对需要补齐的日期读取日记。

```powershell
$logseqArgs = @('--root-dir', 'C:/path/to/logseq', '--graph', 'Work', '--output', 'json')
$journalDay = 20261016
$journalQuery = '[:find ?uuid . :in $ ?day :where [?p :block/journal-day ?day] [?p :block/uuid ?uuid]]'
$lookup = logseq query @logseqArgs --query $journalQuery --inputs "[$journalDay]" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $lookup.status -ne 'ok') { throw 'Logseq 日记查询失败' }
if ($null -ne $lookup.data.result) {
  $journal = logseq show @logseqArgs --uuid $lookup.data.result --linked-references false | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or $journal.status -ne 'ok') { throw 'Logseq 日记读取失败' }
  $journal.data.root
}
```

- 查询成功且 `data.result` 为 `null` 表示该日没有日记页。CLI、图谱或日记读取出错时，记为该来源暂不可用。
- 从 `data.root` 递归读取 `block/children`，用 `block/title` 解读内容，用 `logseq.property/status` 的 `db/ident` 区分任务状态。保留子块提供的执行细节，避免将父任务与子记录重复计入。`block/created-at` 或 `block/updated-at` 可以辅助核对时间，更新时间本身无法确定完成时间。
- 日记来源用图谱名、日期，以及可定位的块标识注明。控制在目标日内，按需查看具体任务引用。
