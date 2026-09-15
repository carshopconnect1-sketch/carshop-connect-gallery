$ErrorActionPreference = 'Stop'
$galleryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$galleryUrl = 'http://127.0.0.1:4180/'
$galleryState = Join-Path $galleryRoot '.preview'
$listener = @(netstat -ano -p tcp | Select-String '^\s*TCP\s+\S+:4180\s+\S+\s+LISTENING\s+\d+\s*$')
if ($listener.Count -gt 0) {
    try { $health = Invoke-RestMethod ($galleryUrl + '__preview') -TimeoutSec 5 } catch { throw '4180番は別のプロセスが使用中です。停止やポート変更は行いません。' }
    if ($health.project -ne 'connect-installation-gallery' -or $health.root -ne $galleryRoot) { throw '4180番の所属が異なるため、既存プロセスを変更しません。' }
    Write-Output "既存プレビューを再利用: $galleryUrl (PID $($health.pid))"
    return
}
$galleryNode = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $galleryState -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outLog = Join-Path $galleryState "$stamp.stdout.log"
$errLog = Join-Path $galleryState "$stamp.stderr.log"
$serverFile = Join-Path $PSScriptRoot 'server.mjs'
$process = Start-Process -FilePath $galleryNode -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $galleryRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
@{ startedAt=(Get-Date).ToString('o'); root=$galleryRoot; pid=$process.Id; executable=$galleryNode; arguments=$serverFile; stdout=$outLog; stderr=$errLog; url=$galleryUrl } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $galleryState 'launcher.json') -Encoding utf8
for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod ($galleryUrl + '__preview') -TimeoutSec 2
        if ($health.project -eq 'connect-installation-gallery' -and $health.root -eq $galleryRoot -and $health.pid -eq $process.Id) { Write-Output "プレビュー起動: $galleryUrl (PID $($process.Id))"; return }
    } catch { }
    if ($process.HasExited) { throw "起動に失敗しました。ログ: $errLog" }
    Start-Sleep -Milliseconds 300
}
throw "HTTP応答を確認できません。ログ: $errLog"
