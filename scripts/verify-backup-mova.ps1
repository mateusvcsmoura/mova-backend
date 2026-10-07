param([string]$Container = "mova-postgres")
$ErrorActionPreference = "Stop"

$arquivo = & (Join-Path $PSScriptRoot "backup-mova.ps1") -Banco mova_dev -Container $Container | Select-Object -Last 1
$temp = "mova_restore_" + (Get-Date -Format "yyyyMMdd_HHmmss")

# Contagens exatas tabela a tabela (pg_stat pode estar desatualizado), numa só consulta.
$contagem = "SELECT string_agg(table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text, ';' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
function Contar([string]$banco) {
  $r = docker exec $Container psql -U mova -d $banco -Atc $contagem
  if ($LASTEXITCODE -ne 0) { throw "Falha ao contar linhas em $banco." }
  $r
}

try {
  & (Join-Path $PSScriptRoot "restore-mova.ps1") -Arquivo $arquivo -Banco $temp -Confirmar $temp -Container $Container | ForEach-Object { Write-Host $_ }
  $origem = Contar "mova_dev"
  $copia = Contar $temp
  $tabelas = ($origem -split ';' | Where-Object { $_ }).Count
  Write-Host "Tabelas comparadas: $tabelas"
  if ($origem -ne $copia) {
    Write-Host "mova_dev:  $origem"
    Write-Host "restaurado: $copia"
    throw "Contagens divergentes entre mova_dev e o banco restaurado."
  }
  Write-Host "Contagens idênticas em todas as tabelas (inclui _prisma_migrations)."
  Write-Host "VERIFICAÇÃO: SUCESSO"
} finally {
  docker exec $Container dropdb -U mova --if-exists $temp | Out-Null
  Write-Host "Banco temporário $temp removido; mova_dev intacto."
}
