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

Из GitHub:

```bash
claude plugin marketplace add max107/claude-openspec-workflow
claude plugin install openspec-workflow@claude-openspec
```

Из локального клона:

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

## Выпуск изменений

1. Правка и проверки из раздела «Проверка».
2. Поднять патч-версию плагина в `plugins/openspec-workflow/.claude-plugin/plugin.json`; в `.claude-plugin/marketplace.json` версий нет.
3. `git push origin main`.

GitHub Actions (`.github/workflows/ci.yml`) на каждый пуш и pull request запускает джобу `check`: `bun run check` (валидаторы, тесты; `openspec validate --strict` только локально, где есть `openspec/`) и `claude plugin validate` маркетплейса и каждого плагина с закреплённой версией CLI.

После зелёного `check` на `main` джоба `release` ставит следующий тег `0.0.N` и создаёт GitHub Release с коммитами со времени прошлого тега. Затем джоба `package` публикует `@max107/openspec-workflow` с версией тега в GitHub Packages (`https://npm.pkg.github.com/`), авторизуясь `GITHUB_TOKEN`. Обе джобы входят в тот же workflow: тег, запушенный с `GITHUB_TOKEN`, новый workflow не запускает. В пакет входят `.claude-plugin/`, `plugins/`, `README.md` и `THIRD_PARTY_LICENSES.md` (`files` в `package.json`; состав: `bun pm pack --dry-run`). Тег релиза — версия репозитория; версию плагина по-прежнему задаёт его `plugin.json`.

Установка пакета:

```bash
printf '@max107:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=<GitHub token с read:packages>\n' >> ~/.npmrc
bun add @max107/openspec-workflow
```
