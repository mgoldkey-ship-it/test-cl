# Краткий акт приёмки

Результаты относятся к автоматическим проверкам в headless Chromium 158.0.8127.18. Чек-лист подтверждает перечисленные сценарии, а не отсутствие всех возможных ошибок.

| Требование | Доказательство |
|---|---|
| Добавление задач | `PASS button, Enter...` и запрет пустого ввода в [логе](tests/results.log); сценарии в [тесте](tests/browser.cjs). |
| Отметка выполненных | `PASS button, Enter, distinct IDs, independent toggle/delete and reload` в [логе](tests/results.log); [пример экрана](tests/screenshots/mobile-filled.png). |
| Удаление задач | Тот же тест проверяет удаление одной из одинаковых задач и затем оставшейся: [тест](tests/browser.cjs), [лог](tests/results.log). |
| Сохранение после обновления | Тест проверяет сохранение двух задач и разных статусов после обновления: [тест](tests/browser.cjs), [лог](tests/results.log). При ошибке хранения показано предупреждение, а не обещание сохранения. |

Адаптивность 375 px и работу при ошибках хранилища также проверяли автоматически. [Пустой экран 375 px](tests/screenshots/mobile-empty.png), [заполненный экран 375 px](tests/screenshots/mobile-filled.png), [пустой экран компьютера](tests/screenshots/desktop-empty.png), [заполненный экран компьютера](tests/screenshots/desktop-filled.png). Ограничения перечислены в [README](README.md).
