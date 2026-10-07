param(
  [switch]$ComSimulador,   # liga o GPS simulado (o veículo "anda"; o geofence do desbloqueio deixa de ser previsível)
  [switch]$SemFrontend,
  [string]$FrontendDir = (Join-Path $PSScriptRoot "..\..\mova-frontend")
)
$ErrorActionPreference = "Stop"
$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")

function Start-Container([string]$nome, [string]$servico, [string[]]$perfil) {
  $estado = docker inspect --format "{{.State.Status}}" $nome 2>$null
  if ($LASTEXITCODE -eq 0 -and $estado) {
    if ($estado -ne "running") {
      Write-Host "Iniciando container existente $nome ($estado)..."
      docker start $nome | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar $nome." }
    } else {
      Write-Host "$nome já está em execução."
    }
    return
  }
  Write-Host "Container $nome não existe; criando pelo docker compose..."
  Push-Location $backendDir
  try {
    docker compose @perfil up -d $servico
    if ($LASTEXITCODE -ne 0) { throw "docker compose up $servico falhou (MinIO exige MINIO_ROOT_USER/MINIO_ROOT_PASSWORD na sessão e ..\minio.license)." }
  } finally { Pop-Location }
}

function Wait-Until([string]$descricao, [scriptblock]$teste, [int]$segundos = 60) {
  $limite = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $limite) {
    try { if (& $teste) { Write-Host "OK  $descricao"; return } } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "Tempo esgotado aguardando: $descricao"
}

docker version --format "{{.Server.Version}}" *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker não está acessível. Abra o Docker Desktop e rode de novo." }

Start-Container "mova-postgres" "postgres" @()
Start-Container "mova-backend-minio-1" "minio" @("--profile", "media")

Wait-Until "PostgreSQL (mova_dev)" { (docker exec mova-postgres pg_isready -U mova -d mova_dev 2>$null) -match "accepting" }
Wait-Until "MinIO health/ready" { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:9000/minio/health/ready").StatusCode -eq 200 }

# Credenciais S3 do backend = credenciais do container local, lidas sem exibir.
$minioEnv = docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" mova-backend-minio-1
foreach ($linha in $minioEnv) {
  if ($linha -like "MINIO_ROOT_USER=*") { $env:MEDIA_S3_ACCESS_KEY_ID = $linha.Substring(16) }
  if ($linha -like "MINIO_ROOT_PASSWORD=*") { $env:MEDIA_S3_SECRET_ACCESS_KEY = $linha.Substring(20) }
}
if (-not $env:MEDIA_S3_ACCESS_KEY_ID) { Write-Warning "Credenciais do MinIO não encontradas: upload de imagens ficará indisponível." }

# Variáveis do processo têm precedência sobre o .env (dotenv não sobrescreve).
$env:NODE_ENV = "development"
$env:SEND_REAL_EMAIL = "false"
$env:LOCALIZACAO_SIMULADOR = if ($ComSimulador) { "true" } else { "false" }
if (-not $env:RATE_LIMIT_AUTH_MAX) { $env:RATE_LIMIT_AUTH_MAX = "200" }

$porta = 3000
if (Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue) {
  Write-Host "Porta $porta já em uso: mantendo o backend que está rodando."
} else {
  Start-Process powershell -WorkingDirectory $backendDir -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='MOVA backend'; npm run dev"
}
Wait-Until "Backend /api/health" { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$porta/api/health").StatusCode -eq 200 } 90

if (-not $SemFrontend) {
  $frontend = Resolve-Path $FrontendDir
  if (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue) {
    Write-Host "Porta 5173 já em uso: mantendo o frontend que está rodando."
  } else {
    Start-Process powershell -WorkingDirectory $frontend -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='MOVA frontend'; npm run dev -- --port 5173 --strictPort"
  }
  Wait-Until "Frontend http://localhost:5173" { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:5173").StatusCode -eq 200 } 60
}

Write-Host ""
Write-Host "MOVA local pronto. Abra http://localhost:5173  (verificação: scripts\check-mova.ps1)"
Write-Host "GPS simulado: $($env:LOCALIZACAO_SIMULADOR). E-mail real: desligado."
