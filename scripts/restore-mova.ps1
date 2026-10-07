param(
  [Parameter(Mandatory = $true)][string]$Arquivo,
  [string]$Banco = "mova_dev",
  [string]$Confirmar = "",
  [string]$Container = "mova-postgres"
)
$ErrorActionPreference = "Stop"

if ($Banco -eq "mova_test") { throw "Restore em mova_test é bloqueado." }
if ($Banco -ne "mova_dev" -and $Banco -notmatch '^mova_restore_[a-z0-9_]+$') {
  throw "Banco não permitido: $Banco (use mova_dev ou mova_restore_*)."
}
if (-not (Test-Path $Arquivo)) { throw "Arquivo não encontrado: $Arquivo" }
$arquivoAbs = (Resolve-Path $Arquivo).Path
$estado = docker inspect --format "{{.State.Status}}" $Container 2>$null
if ($LASTEXITCODE -ne 0 -or $estado -ne "running") { throw "Container local $Container não está em execução." }

Write-Host "RESTORE DESTRUTIVO"
Write-Host "Banco alvo: $Banco (container local $Container)"
Write-Host "Arquivo:    $arquivoAbs"
if (-not $Confirmar) { $Confirmar = Read-Host "Digite o nome do banco ($Banco) para confirmar" }
if ($Confirmar -ne $Banco) { throw "Confirmação não confere. Nada foi alterado." }

$existe = docker exec $Container psql -U mova -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$Banco'"
if (-not $existe) {
  if ($Banco -notlike "mova_restore_*") { throw "Banco $Banco não existe." }
  docker exec $Container createdb -U mova $Banco
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar $Banco." }
}

$temporario = "/tmp/restore_$([guid]::NewGuid().ToString('N')).dump"
try {
  docker cp $arquivoAbs "${Container}:$temporario" | Out-Null
  # --clean --if-exists: substitui os objetos existentes; --no-owner: dono = mova.
  docker exec $Container pg_restore -U mova -d $Banco --clean --if-exists --no-owner --exit-on-error $temporario
  if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou (código $LASTEXITCODE)." }
} finally {
  docker exec $Container rm -f $temporario | Out-Null
}
Write-Host "Resultado: SUCESSO ($Banco restaurado)"
