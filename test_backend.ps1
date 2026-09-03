$ErrorActionPreference = 'Stop'

# Compatibilidade com o antigo comando manual. A verificação canônica agora
# compila e executa exatamente apps/backend/dist/main.js contra um PostgreSQL 16
# descartável, com migrations reais e 28 asserções HTTP.
$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$exitCode = 0

Push-Location -LiteralPath $repositoryRoot
try {
    & pnpm build:backend
    if ($LASTEXITCODE -ne 0) {
        $exitCode = $LASTEXITCODE
    }
    else {
        & pnpm test:smoke
        $exitCode = $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

exit $exitCode
