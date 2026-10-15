# Creates desktop shortcut "Rozpiznavach tekhniky" (name built from char codes to avoid encoding issues)
$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyw  = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\pythonw.exe'
$desk = [Environment]::GetFolderPath('Desktop')
$name = -join ([char[]](@(1056,1086,1079,1087,1110,1079,1085,1072,1074,1072,1095,32,1090,1077,1093,1085,1110,1082,1080)))
$tmp  = Join-Path $desk 'recognizer_tmp.lnk'
$ws   = New-Object -ComObject WScript.Shell
$lnk  = $ws.CreateShortcut($tmp)
$lnk.TargetPath       = $pyw
$lnk.Arguments        = '"' + (Join-Path $dir 'app.py') + '"'
$lnk.WorkingDirectory = $dir
$lnk.IconLocation     = (Join-Path $dir 'icon.ico') + ',0'
$lnk.Description      = 'ResNet18 vehicle classifier (practice 4.13)'
$lnk.Save()
$final = Join-Path $desk ($name + '.lnk')
if (Test-Path -LiteralPath $final) { Remove-Item -LiteralPath $final -Force }
Rename-Item -LiteralPath $tmp -NewName ($name + '.lnk')
if (Test-Path -LiteralPath $final) { 'SHORTCUT_OK' } else { 'SHORTCUT_FAIL' }
