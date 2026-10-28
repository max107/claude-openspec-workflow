# claude-openspec

Маркетплейс `claude-openspec` (`.claude-plugin/marketplace.json`) с одним плагином `openspec-workflow` в `plugins/openspec-workflow`: скил `openspec`, агент `spec-miner`, команда `/requirements`, правила OpenSpec и их хуки. Компоненты скопированы из плагина `my-workflow` репозитория `~/projects/falaleev/claude-workflow`.

`openspec/` — спецификации и изменения этого репозитория. Лежит только на диске: каталог в `.gitignore`.

Создание, перенос или правка скила, команды или агента идёт по `skill-authoring.md`: прочитать его до первой правки.

## После каждого изменения плагина

1. Проверка, все должны пройти:
   ```bash
   bun run check </dev/null   # валидаторы, openspec validate --strict, тесты
   claude plugin validate .
   claude plugin validate plugins/openspec-workflow
   ```
2. Поднять патч-версию в `plugins/openspec-workflow/.claude-plugin/plugin.json` (`0.1.0` → `0.1.1`).
3. Если плагин установлен:
   ```bash
   claude plugin marketplace update claude-openspec
   claude plugin update openspec-workflow@claude-openspec
   ```
4. Коммит изменения.

Правки только в `CLAUDE.md`, `README.md` и `skill-authoring.md` не меняют плагин: версию не поднимать.

## Хук правил

`plugins/openspec-workflow/scripts/hooks/workflow-context.js` — та же копия, что в плагинах `claude-workflow`: имя плагина скрипт берёт из `plugin.json`. Копии должны совпадать:

```bash
cmp plugins/openspec-workflow/scripts/hooks/workflow-context.js ~/projects/falaleev/claude-workflow/plugins/my-workflow/scripts/hooks/workflow-context.js
```
