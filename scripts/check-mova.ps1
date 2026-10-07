$falhas = 0
function Check([string]$nome, [scriptblock]$teste) {
  try { $ok = & $teste } catch { $ok = $false }
  if ($ok) { Write-Host "OK     $nome" } else { Write-Host "FALHA  $nome"; $script:falhas++ }
}
function Status([string]$url) {
  try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
}

Check "PostgreSQL aceita conexões"        { (docker exec mova-postgres pg_isready -U mova -d mova_dev 2>$null) -match "accepting" }
Check "Banco de demonstração = mova_dev"  { (docker exec mova-postgres psql -U mova -d mova_dev -Atc "SELECT current_database()" 2>$null) -eq "mova_dev" }
Check "MinIO health/live 200"             { (Status "http://127.0.0.1:9000/minio/health/live") -eq 200 }
Check "MinIO health/ready 200"            { (Status "http://127.0.0.1:9000/minio/health/ready") -eq 200 }
Check "Backend /api/health 200"           { (Status "http://localhost:3000/api/health") -eq 200 }
Check "Backend /api/ready 200 (banco)"    { (Status "http://localhost:3000/api/ready") -eq 200 }
Check "Frontend http://localhost:5173 200" { (Status "http://localhost:5173") -eq 200 }

$dados = docker exec mova-postgres psql -U mova -d mova_dev -Atc 'SELECT (SELECT count(*) FROM \"Conta\"), (SELECT count(*) FROM \"Veiculo\"), (SELECT count(*) FROM \"VeiculoImagem\" WHERE status = ''READY'')' 2>$null
if ($dados) {
  $c = $dados.Split("|")
  Write-Host "INFO   mova_dev: $($c[0]) contas, $($c[1]) veículos, $($c[2]) imagens prontas"
}
if ($falhas) { Write-Host "$falhas verificação(ões) falharam."; exit 1 }
Write-Host "Ambiente local OK."
