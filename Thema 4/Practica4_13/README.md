# Практична робота 4.13. Репозиторії аналітичних моделей: transfer learning і reinforcement learning

| Частина | Ноутбук |
|---|---|
| 1 (індивідуальна). Transfer learning | [`4.13_1_transfer_learning.ipynb`](4.13_1_transfer_learning.ipynb) |
| 2 (групова). RL-агент DQN | [`4.13_2_rl_dqn.ipynb`](4.13_2_rl_dqn.ipynb) |
| Презентація результатів (12 слайдів, обидві частини) | [`4.13_presentation.pdf`](4.13_presentation.pdf) · [`4.13_presentation.pptx`](4.13_presentation.pptx) |

## Частина 1. Transfer learning
Модель MobileNetV2 (ImageNet) з репозиторію Keras Applications (GitHub-реліз, перевірка SHA-256, model card) адаптується до класифікації предметів речового забезпечення (Fashion-MNIST) при малій кількості розмітки.

| Фото на клас | З нуля | Feature extraction | Fine-tuning |
|---:|---:|---:|---:|
| 10 | 0.727 | **0.750** | 0.748 |
| 25 | 0.761 | 0.795 | **0.796** |
| 50 | 0.797 | 0.811 | **0.816** |
| 100 | 0.821 | 0.833 | **0.840** |

## Частина 2. Deep Q-Network для маршруту логістичного забезпечення
Колона S→G, дві переправи; розвідка перед рейсом повідомляє, чи коротка переправа під вогнем. DQN (TensorFlow, experience replay, target network) порівнюється з табличним Q-learning і двома правилами.

| Агент | Винагорода | Кроків | Кроків під вогнем |
|---|---:|---:|---:|
| Правило: завжди коротка переправа | 10.7 | 19.0 | 2.82 |
| Правило: завжди обхід | 67.5 | 30.1 | 0.10 |
| Табличний Q-learning | 75.1 | 24.6 | 0.01 |
| **DQN-агент** | **74.6** | **24.6** | **0.03** |

DQN їде коротко, коли переправа вільна (19 кроків), і обходить, коли вона під вогнем (30 кроків). Навчена модель: `models/dqn_route_agent.keras`.

## Запуск
```bash
pip install tensorflow scikit-learn pandas matplotlib seaborn
jupyter notebook
```
Ваги MobileNetV2 (`model_repo/*.h5`, 9.4 MB) і дані Fashion-MNIST (`data/*.gz`) завантажуються з GitHub під час першого запуску частини 1.
