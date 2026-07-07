# Seed del mapa "Terreno Test 2 - Lago y Montaña" (worldgen Go).
# Requisitos: stack jdd levantado (postgres + redis healthy).

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "==> Sembrando Lago y Montaña (Go worldgen, puede tardar varios minutos)..." -ForegroundColor Cyan
docker compose --profile tools run --rm seed-lago
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Listo. Abrí: http://localhost:8080/?bloque=lago" -ForegroundColor Green
