#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds the Vocalis web app and publishes it as a live update bundle to GitHub Pages.

.DESCRIPTION
    1. Runs vite build
    2. Creates a ZIP of the dist/ folder
    3. Generates a version manifest
    4. Pushes to the gh-pages branch on GitHub

.PARAMETER Version
    The version string for this release (e.g. "1.0.0")

.EXAMPLE
    .\publish-update.ps1 -Version "1.0.1"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Vocalis Live Update Publisher ===" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow

# 1. Build
Write-Host "`n[1/5] Building web assets..." -ForegroundColor Green
& npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# 2. Create ZIP bundle
$bundleId = "vocalis-$Version-$(Get-Date -Format 'yyyyMMddHHmmss')"
$zipPath = "$PSScriptRoot\dist\$bundleId.zip"
Write-Host "`n[2/5] Creating bundle ZIP: $bundleId.zip" -ForegroundColor Green

# Use .NET to create ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceDir = "$PSScriptRoot\dist"
$files = Get-ChildItem $sourceDir -File | Where-Object { $_.Name -ne "$bundleId.zip" }
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    (Resolve-Path "$sourceDir").Path,
    (Resolve-Path $zipPath).Path,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "  Bundle size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Gray

# 3. Generate version manifest
Write-Host "`n[3/5] Generating version manifest..." -ForegroundColor Green
$manifest = @{
    version = $Version
    bundleId = $bundleId
    bundleUrl = "https://nicodiola120.github.io/vocalis/$bundleId.zip"
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 3

$manifestPath = "$PSScriptRoot\dist\version.json"
$manifest | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host "  manifest.json written" -ForegroundColor Gray

# 4. Copy zip to dist root for GitHub Pages
Copy-Item $zipPath "$PSScriptRoot\dist\$bundleId.zip" -Force

# 5. Push to gh-pages branch
Write-Host "`n[4/5] Deploying to GitHub Pages..." -ForegroundColor Green
$tempDir = "$env:TEMP\vocalis-ghpages-$(Get-Random)"

try {
    git clone --branch gh-pages "https://github.com/nicodiola120/vocalis.git" $tempDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  gh-pages branch not found, creating..." -ForegroundColor Yellow
        git checkout --orphan gh-pages 2>&1
        git rm -rf . 2>&1
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }
} catch {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

Set-Location $tempDir

# Clean old files except .git
Get-ChildItem -Path $tempDir -Exclude ".git" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Copy new build output
Copy-Item "$PSScriptRoot\dist\*" -Destination $tempDir -Recurse -Force

# Commit and push
git add -A 2>&1
git commit -m "Update to v$Version ($bundleId)" 2>&1
git push origin gh-pages 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[5/5] Published successfully!" -ForegroundColor Green
    Write-Host "  Version: $Version" -ForegroundColor Cyan
    Write-Host "  Bundle:  $bundleId.zip" -ForegroundColor Cyan
    Write-Host "  URL:     https://nicodiola120.github.io/vocalis/$bundleId.zip" -ForegroundColor Cyan
    Write-Host "  Manifest: https://nicodiola120.github.io/vocalis/version.json" -ForegroundColor Cyan
} else {
    Write-Host "`nFailed to push to GitHub. Check your credentials." -ForegroundColor Red
}

Set-Location $PSScriptRoot

# Cleanup
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nDone! Testers will receive the update on next app launch." -ForegroundColor Green
