# DeepSeek Harness Portable. Copyright 2026 Tsungloong.
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# A PowerShell 7 parent can pass its own module path into Windows PowerShell.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
try {
    $architecture = $env:PROCESSOR_ARCHITEW6432
    if (-not $architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
    if ($architecture -ne 'AMD64') { throw 'Windows x64 is required.' }
    $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'manifest.json') | ConvertFrom-Json
    $target = 'windows-x64'
    $version = $manifest.node.version
    $runtime = Join-Path $root "runtimes\$target"
    $node = Join-Path $runtime 'node\node.exe'
    $previous = Join-Path $runtime 'node.previous'
    if (-not (Test-Path (Join-Path $runtime 'node')) -and (Test-Path $previous)) {
        Move-Item -LiteralPath $previous -Destination (Join-Path $runtime 'node')
    }
    $actualVersion = if (Test-Path $node) { & $node --version } else { '' }
    if ($actualVersion -ne "v$version" -or ($Arguments.Count -gt 0 -and $Arguments[0] -eq 'repair')) {
        $archive = Join-Path $root "packages\bootstrap\$target\node-$version.zip"
        $stage = Join-Path $root "temp\node-$target-$PID"
        $lock = Join-Path $runtime '.node-lock'
        New-Item -ItemType Directory -Force -Path (Split-Path $archive), $runtime, (Join-Path $root 'temp') | Out-Null
        if (Test-Path $lock) { throw "Node installation is active. If interrupted, remove $lock and retry." }
        New-Item -ItemType Directory -Path $lock | Out-Null
        try {
            if (-not (Test-Path $archive)) {
                $url = $manifest.node.$target.url
                $sources = @($url)
                foreach ($mirror in $manifest.mirrors.node) { $sources += $url -replace '^https://nodejs\.org/dist/', $mirror }
                $downloaded = $false
                foreach ($source in $sources) {
                    try {
                        Write-Host "[portable] Downloading Node.js $version from $source"
                        $options = @{ Uri = $source; OutFile = "$archive.part"; UseBasicParsing = $true; TimeoutSec = 300 }
                        if ($env:HTTPS_PROXY) { $options.Proxy = $env:HTTPS_PROXY }
                        Invoke-WebRequest @options
                        Move-Item -LiteralPath "$archive.part" -Destination $archive -Force
                        $downloaded = $true
                        break
                    } catch {
                        Write-Host "[portable] Download failed: $($_.Exception.Message)"
                    }
                }
                if (-not $downloaded) { throw 'All download sources failed. Check the network or HTTPS_PROXY.' }
            }
            $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($hash -ne $manifest.node.$target.sha256) {
                Move-Item -LiteralPath $archive -Destination "$archive.bad" -Force
                throw "Checksum mismatch; quarantined to $archive.bad"
            }
            Write-Host '[portable] Extracting Node.js'
            New-Item -ItemType Directory -Path $stage | Out-Null
            Expand-Archive -LiteralPath $archive -DestinationPath $stage
            $extracted = Get-ChildItem -LiteralPath $stage -Directory | Select-Object -First 1
            if (-not $extracted -or -not (Test-Path (Join-Path $extracted.FullName 'node.exe'))) { throw 'Invalid Node archive layout.' }
            if ((& (Join-Path $extracted.FullName 'node.exe') --version) -ne "v$version") { throw 'Node version mismatch.' }
            if (Test-Path $previous) { Remove-Item -LiteralPath $previous -Recurse -Force }
            if (Test-Path (Join-Path $runtime 'node')) { Move-Item -LiteralPath (Join-Path $runtime 'node') -Destination $previous }
            Move-Item -LiteralPath $extracted.FullName -Destination (Join-Path $runtime 'node')
            if (Test-Path $previous) { Remove-Item -LiteralPath $previous -Recurse -Force }
        } finally {
            if (-not (Test-Path (Join-Path $runtime 'node')) -and (Test-Path $previous)) {
                Move-Item -LiteralPath $previous -Destination (Join-Path $runtime 'node')
            }
            if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
            Remove-Item -LiteralPath $lock -Force
        }
    }
    & $node (Join-Path $PSScriptRoot 'portable.mjs') --root $root --target $target @Arguments
    exit $LASTEXITCODE
} catch {
    Write-Host "[portable] Error: $($_.Exception.Message)"
    exit 1
}
