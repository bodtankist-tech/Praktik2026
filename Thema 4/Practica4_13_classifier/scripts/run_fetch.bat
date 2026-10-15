@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
echo Завантаження відкритих зображень з Wikimedia Commons...
"%PY%" -m pip install --progress-bar off -q certifi > "%~dp0fetch_log.txt" 2>&1
"%PY%" "%~dp0fetch_images.py" 45 >> "%~dp0fetch_log.txt" 2>&1
echo Встановлення PyTorch (CPU)...
"%PY%" -m pip install --progress-bar off torch torchvision --index-url https://download.pytorch.org/whl/cpu > "%~dp0torch_log.txt" 2>&1
"%PY%" -c "import torch,torchvision;from torchvision.models import resnet18,ResNet18_Weights;resnet18(weights=ResNet18_Weights.DEFAULT);print('TORCH_OK',torch.__version__)" >> "%~dp0torch_log.txt" 2>&1
echo ALL_DONE >> "%~dp0torch_log.txt"
