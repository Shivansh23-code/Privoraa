# run-local.ps1 — start the Privoraa backend against your local MySQL (no Redis).
# Usage:  .\run-local.ps1
#
# Loads .env, builds the jar if needed, then runs with the "local" Spring profile
# (in-memory cache, Redis health probe off, datasource pinned to localhost:3306/privoraa
# so a stray DB_URL environment variable can't redirect it).

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# --- Load .env (KEY=VALUE lines) into this process's environment ---
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $i = $line.IndexOf('=')
            $k = $line.Substring(0, $i).Trim()
            $v = $line.Substring($i + 1).Trim()
            [Environment]::SetEnvironmentVariable($k, $v, 'Process')
        }
    }
    Write-Host ".env loaded" -ForegroundColor Green
} else {
    Write-Host "No .env found. Copy .env.example to .env and set OPENROUTER_API_KEY + DB_PASS." -ForegroundColor Yellow
}

# --- Prefer JDK 21 if installed at the standard location ---
$jdk21 = "C:\Program Files\Java\jdk-21"
if (Test-Path $jdk21) { $env:JAVA_HOME = $jdk21 }

# --- Build the jar on first run ---
$jar = "target\privoraa-backend-2.0.0.jar"
if (-not (Test-Path $jar)) {
    Write-Host "Building backend (first run, this can take a couple of minutes)…" -ForegroundColor Cyan
    & .\mvnw.cmd -q -B clean package -DskipTests
}

Write-Host "Starting Privoraa API → http://localhost:8099  (Swagger: /swagger-ui.html)" -ForegroundColor Cyan
java -jar $jar --spring.profiles.active=local
