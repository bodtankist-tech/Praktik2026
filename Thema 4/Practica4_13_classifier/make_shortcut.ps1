# Creates the desktop shortcut "Rozpiznavach tekhniky".
# Windows shortcuts made via WScript.Shell keep paths in the ANSI code page, so Cyrillic folder
# names (OneDrive\Dokumenty) break. The shortcut therefore points to a small launcher in an
# ASCII-only folder (%LOCALAPPDATA%\RozpiznavachTekhniky), which opens app.py from this folder.
$cands = @($PSScriptRoot, (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Praktik2026\Thema 4\Practica4_13_classifier'))
$dir = $cands | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'app.py')) } | Select-Object -First 1
if (-not $dir) { 'SHORTCUT_FAIL: project folder not found'; exit 1 }
$pyw  = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\pythonw.exe'
$home2 = Join-Path $env:LOCALAPPDATA 'RozpiznavachTekhniky'
New-Item -ItemType Directory -Force -Path $home2 | Out-Null
Copy-Item -LiteralPath (Join-Path $dir 'icon.ico') -Destination (Join-Path $home2 'icon.ico') -Force
[IO.File]::WriteAllText((Join-Path $home2 'path.txt'), $dir, (New-Object Text.UTF8Encoding($false)))
$launcher = @'
import os, runpy, sys
from pathlib import Path
here = Path(__file__).resolve().parent
proj = Path((here / "path.txt").read_text(encoding="utf-8").strip())
os.chdir(proj)
sys.argv = [str(proj / "app.py")]
runpy.run_path(str(proj / "app.py"), run_name="__main__")
'@
[IO.File]::WriteAllText((Join-Path $home2 'launch.pyw'), $launcher, (New-Object Text.UTF8Encoding($false)))
$desk = [Environment]::GetFolderPath('Desktop')
$name = -join ([char[]](@(1056,1086,1079,1087,1110,1079,1085,1072,1074,1072,1095,32,1090,1077,1093,1085,1110,1082,1080)))
$tmp  = Join-Path $desk 'recognizer_tmp.lnk'
$ws   = New-Object -ComObject WScript.Shell
$lnk  = $ws.CreateShortcut($tmp)
$lnk.TargetPath       = $pyw
$lnk.Arguments        = '"' + (Join-Path $home2 'launch.pyw') + '"'
$lnk.WorkingDirectory = $home2
$lnk.IconLocation     = (Join-Path $home2 'icon.ico') + ',0'
$lnk.Description      = 'ResNet18 vehicle classifier (practice 4.13)'
$lnk.Save()
$final = Join-Path $desk ($name + '.lnk')
if (Test-Path -LiteralPath $final) { Remove-Item -LiteralPath $final -Force }
Rename-Item -LiteralPath $tmp -NewName ($name + '.lnk')
if (Test-Path -LiteralPath $final) { 'SHORTCUT_OK' } else { 'SHORTCUT_FAIL' }
