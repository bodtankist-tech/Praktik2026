"""Спільні налаштування: класи, перетворення зображень, побудова моделі."""
import ssl
from pathlib import Path

import certifi
import torch
from torch import nn
from torchvision import transforms
from torchvision.models import ResNet18_Weights, resnet18

# Ваги ResNet18 завантажуються з download.pytorch.org; перевірка сертифіката
# через актуальний набір certifi (системний набір Windows може бути застарілим).
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

ROOT = Path(__file__).resolve().parents[1]
CLASSES = ["uav", "armor", "truck"]
CLASS_UA = {"uav": "БПЛА", "armor": "Бронетехніка", "truck": "Вантажний автомобіль"}
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]  # нормування ImageNet

TRAIN_TF = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(0.3, 0.3, 0.2),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])
EVAL_TF = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def build_model(pretrained: bool = True, unfreeze_layer4: bool = False) -> nn.Module:
    """ResNet18 з ImageNet; фінальний шар 1000 класів замінено на 3 класи."""
    model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
    for p in model.parameters():
        p.requires_grad = False
    if unfreeze_layer4:
        for p in model.layer4.parameters():
            p.requires_grad = True
    model.fc = nn.Linear(model.fc.in_features, len(CLASSES))  # новий шар, вчиться з нуля
    return model


def load_trained(path=None) -> nn.Module:
    path = path or ROOT / "models" / "resnet18_vehicles.pt"
    model = build_model(pretrained=False)
    model.load_state_dict(torch.load(path, map_location="cpu"))
    return model.eval()
