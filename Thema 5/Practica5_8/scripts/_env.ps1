# Допоміжний файл: читає .env у змінні середовища поточного процесу PowerShell.
$envFile = Join-Path (Join-Path $PSScriptRoot "..") ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=\s][^=]*)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim().Trim('"'), "Process")
        }
    }
}
