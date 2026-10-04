# Backup LOCAL do PostgreSQL do MOVA (RNF10).
#   powershell -ExecutionPolicy Bypass -File scripts\backup-mova.ps1 [-Banco mova_dev] [-Pasta backups]
#
# Gera backups\<banco>_<aaaa-MM-dd_HHmmss>.dump (pg_dump -Fc) a partir do
# container local mova-postgres. Não usa senha (socket local do container) e
# nunca sobrescreve um arquivo existente. backups/ e *.dump são ignorados pelo Git.
param(
  [string]$Banco = "mova_dev",
  [string]$Pasta = (Join-Path $PSScriptRoot "..\backups"),
  [string]$Container = "mova-postgres"
)
$ErrorActionPreference = "Stop"

if ($Banco -notmatch '^[a-z0-9_]+$') { throw "Nome de banco inválido: $Banco" }
if ($Banco -eq "mova_test") { Write-Warning "mova_test é descartável e recriado pelos testes; o backup de rotina é mova_dev." }

$estado = docker inspect --format "{{.State.Status}}" $Container 2>$null
if ($LASTEXITCODE -ne 0 -or $estado -ne "running") { throw "Container $Container não está em execução." }

New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
$carimbo = Get-Date -Format "yyyy-MM-dd_HHmmss"
$nome = "${Banco}_$carimbo.dump"
$destino = Join-Path (Resolve-Path $Pasta) $nome
if (Test-Path $destino) { throw "Arquivo já existe, não será sobrescrito: $destino" }
$temporario = "/tmp/$nome"

Write-Host "Banco:     $Banco (container $Container)"
Write-Host "Início:    $carimbo"
try {
  # -Fc: formato custom, comprimido e restaurável seletivamente com pg_restore.
  docker exec $Container pg_dump -U mova -d $Banco -Fc -f $temporario
  if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (código $LASTEXITCODE)." }
  docker cp "${Container}:$temporario" $destino | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao copiar o dump do container." }
} finally {
  docker exec $Container rm -f $temporario | Out-Null
}

$tamanho = (Get-Item $destino).Length
if ($tamanho -le 0) { throw "Backup vazio: $destino" }
Write-Host "Arquivo:   $destino"
Write-Host ("Tamanho:   {0:N0} bytes" -f $tamanho)
Write-Host "Resultado: SUCESSO"
# Saída do pipeline: caminho do arquivo (usado por verify-backup-mova.ps1).
$destino
