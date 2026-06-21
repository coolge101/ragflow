# TBOX 远端拉取同步（Windows PowerShell + Docker Desktop）
#
# Usage (在仓库根目录 C:\ragflow\ragflow):
#   .\scripts\tbox_sync_pull.ps1
#   .\scripts\tbox_sync_pull.ps1 -BackupName "tbox-sync-20260621-075600"
#   .\scripts\tbox_sync_pull.ps1 -BackupDir "C:\ragflow\backups\tbox-sync-20260621-075600"
#
param(
    [string]$BackupName = "",
    [string]$BackupDir = "",
    [string]$GitRemote = "origin",
    [string]$GitBranch = "tbox-deploy",
    [switch]$SkipGit,
    [switch]$SkipRestore
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not $BackupDir) {
    $backupRoot = if ($env:TBOX_SYNC_LOCAL_BACKUP_ROOT) { $env:TBOX_SYNC_LOCAL_BACKUP_ROOT } else { Join-Path (Split-Path -Parent $Root) "backups" }
    if (-not (Test-Path $backupRoot)) { $backupRoot = Join-Path $Root "backups" }
    if ($BackupName) {
        $BackupDir = Join-Path $backupRoot $BackupName
    } elseif (Test-Path (Join-Path $backupRoot "tbox-sync-latest")) {
        $BackupDir = (Get-Item (Join-Path $backupRoot "tbox-sync-latest")).Target
    } else {
        $latest = Get-ChildItem -Path $backupRoot -Directory -Filter "tbox-sync-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($latest) { $BackupDir = $latest.FullName }
    }
}

if (-not $BackupDir -or -not (Test-Path $BackupDir)) {
    Write-Error "找不到备份目录。请 -BackupDir 或 -BackupName 指定，或将备份放在 C:\ragflow\backups\"
}

if (-not $SkipGit) {
    Write-Host "==> git pull $GitRemote $GitBranch"
    git fetch $GitRemote $GitBranch
    git checkout $GitBranch
    git pull $GitRemote $GitBranch
}

if (-not $SkipRestore) {
    Write-Host "==> restore from $BackupDir"
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) {
        bash "$Root/scripts/tbox_sync_restore.sh" "$BackupDir"
    } else {
        Write-Error "需要 Git Bash 或 WSL 中的 bash 来执行 tbox_sync_restore.sh。安装 Git for Windows 后重试。"
    }
}

Write-Host "==> Done. Open http://127.0.0.1:5180"
