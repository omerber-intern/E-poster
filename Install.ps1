# Cursor Rules Setup - Windows
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Cursor Rules Setup ===" -ForegroundColor Cyan

# Check if specify is installed
if (Get-Command specify -ErrorAction SilentlyContinue) {
    Write-Host "Spec Kit already installed. Opening Cursor..."
    & cursor . 2>$null
    if ($LASTEXITCODE -ne 0) { Start-Process "cursor" -ArgumentList "." }
    exit 0
}

# Check if uv exists
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "Installing uv..."
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
}

Write-Host "Installing Spec Kit..."
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

Write-Host "Opening Cursor..."
& cursor . 2>$null
if ($LASTEXITCODE -ne 0) { Start-Process "cursor" -ArgumentList "." }

Write-Host "Done!" -ForegroundColor Green
