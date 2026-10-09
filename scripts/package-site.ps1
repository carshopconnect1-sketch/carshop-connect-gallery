param([string]$ArchivePath)
$ErrorActionPreference='Stop'
$siteRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dist=Join-Path $siteRoot 'dist'
$sha=(& git -C $siteRoot rev-parse --verify HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40}$'){throw 'Commit the Site source before packaging.'}
if(!$ArchivePath){$ArchivePath=Join-Path $siteRoot ('.deploy/site-'+$sha+'.tar.gz')}
if(![IO.Path]::IsPathRooted($ArchivePath)){$ArchivePath=Join-Path $siteRoot $ArchivePath}
$archive=[IO.Path]::GetFullPath($ArchivePath)
if(!$archive.StartsWith($siteRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive must stay inside this project.'}
if(Test-Path -LiteralPath $archive){throw 'Archive already exists. Preserve it and choose another output path.'}
foreach($relative in @('.openai/hosting.json','server/index.js','client/index.html')){
  if(!(Test-Path -LiteralPath (Join-Path $dist $relative) -PathType Leaf)){throw 'Run npm run build before packaging.'}
}
if(@(Get-ChildItem -LiteralPath $dist -Recurse -Attributes ReparsePoint).Count){throw 'Build contains links.'}
$source=Get-Content -LiteralPath (Join-Path $siteRoot '.openai/hosting.json') -Raw|ConvertFrom-Json
$hosting=Get-Content -LiteralPath (Join-Path $dist '.openai/hosting.json') -Raw|ConvertFrom-Json
if(!$source.project_id -or $hosting.project_id -ne $source.project_id -or $hosting.d1 -ne $source.d1 -or $hosting.r2 -ne $source.r2){throw 'Build hosting metadata does not match source.'}
New-Item -ItemType Directory -Path (Split-Path $archive -Parent) -Force|Out-Null
$migrationOutput=Join-Path $dist '.openai/drizzle'
New-Item -ItemType Directory -Path $migrationOutput -Force|Out-Null
foreach($file in Get-ChildItem -LiteralPath (Join-Path $siteRoot 'drizzle') -File -Filter '*.sql'){
  Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $migrationOutput $file.Name)
}
$tar=(Get-Command tar.exe -ErrorAction Stop).Source
& $tar -czf $archive -C $siteRoot dist
if($LASTEXITCODE -ne 0){throw 'Packaging failed.'}
$entries=@(& $tar -tzf $archive)
if($LASTEXITCODE -ne 0){throw 'Archive cannot be read.'}
foreach($file in @('dist/.openai/hosting.json','dist/server/index.js','dist/client/index.html')){if($entries -notcontains $file){throw "Required artifact missing: $file"}}
if(@($entries|Where-Object {$_ -notmatch '^dist(/|$)' -or $_ -match '(^|/)(\.git|\.source|\.preview|node_modules)(/|$)' -or $_ -match '/data/(photo-replacements|mail-publications)\.json$'}).Count){throw 'Archive contains source-only files.'}
$stream=[IO.File]::OpenRead($archive)
$gzip=[IO.Compression.GZipStream]::new($stream,[IO.Compression.CompressionMode]::Decompress)
try{$buffer=New-Object byte[] 1048576;$expanded=0L;while(($n=$gzip.Read($buffer,0,$buffer.Length)) -gt 0){$expanded+=$n}}finally{$gzip.Dispose();$stream.Dispose()}
$bytes=(Get-Item -LiteralPath $archive).Length
if($bytes -ge 268435456 -or $expanded -ge 268435456){throw "Sites 256MiB limit exceeded: compressed=$bytes expanded=$expanded"}
$record=@{project_id=$hosting.project_id;commit_sha=$sha;archive=$archive;bytes=$bytes;expandedBytes=$expanded;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower();entries=$entries.Count;packedAt=(Get-Date).ToString('o')}
$record|ConvertTo-Json -Depth 5|Set-Content -LiteralPath ($archive+'.json') -Encoding utf8
$record|ConvertTo-Json -Compress
