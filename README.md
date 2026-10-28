# claude-openspec

Маркетплейс `claude-openspec` с плагином `openspec-workflow`: имена с префиксом `claude-` Claude Code резервирует за Anthropic.

Плагин Claude Code для работы через [OpenSpec](https://github.com/Fission-AI/OpenSpec). Большое изменение идёт как change: proposal, дельты спецификации, задачи с файлами и доказывающей командой. Задачи раздаются субагентам, работа принимается по сценариям, после приёмки change архивируется.

Компоненты скопированы из плагина `my-workflow` (репозиторий `claude-workflow`), чтобы OpenSpec можно было ставить отдельно.

## Состав

| Компонент | Путь | Что делает |
| --- | --- | --- |
| Скил `openspec` | `plugins/openspec-workflow/skills/openspec/SKILL.md` | Процесс: `openspec/` в проекте, базовая спецификация области, вопросы, change, передача задач, приёмка, архив |
| Агент `spec-miner` | `plugins/openspec-workflow/agents/spec-miner.md` | Извлекает текущее поведение кода в `openspec/specs/<capability>/spec.md` или в дельту change |
| Команда `/requirements` | `plugins/openspec-workflow/commands/requirements.md` | Проблема, доказательства, гипотеза, метрика и границы фичи до change |
| Правило `openspec-changes` | `plugins/openspec-workflow/rules/openspec-changes.md` | Порог: когда изменение начинается как OpenSpec change |
| Правило `delegation` | `plugins/openspec-workflow/rules/delegation.md` | Задачи change уходят субагентам (`sonnet`, `haiku`), основная модель пишет change и принимает работу |
| Правило `code-discovery` | `plugins/openspec-workflow/rules/code-discovery.md` | Как искать код при написании change |
| Хуки | `plugins/openspec-workflow/hooks/` | Доставка правил и напоминание о пороге на каждом сообщении, см. `hooks/README.md` |

## Установка

```bash
claude plugin marketplace add ~/projects/falaleev/claude-openspec
claude plugin install openspec-workflow@claude-openspec
```

При включённом `my-workflow` те же скил, агент, команда и правила приходят дважды: `my-workflow:openspec` и `openspec-workflow:openspec`.

## Проверка

```bash
bun install
bun run check </dev/null   # валидаторы, openspec validate --strict (если есть openspec/), тесты
claude plugin validate .
claude plugin validate plugins/openspec-workflow
```
