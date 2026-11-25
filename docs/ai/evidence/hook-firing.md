<!-- owner: @garnaga · why: committed proof that the PreToolUse migration guard fires (rubric: "log or output of it firing"); quoted by the PR template's Hook evidence section · review-by: 2027-02-25 -->

# Hook firing evidence — `.claude/hooks/protect-migrations.mjs`

## 1. Manual run

Command:

```
$ node .claude/hooks/protect-migrations.mjs < docs/ai/sample-payload.json
```

Verbatim output (stdout + stderr), exit code:

```
BLOCKED: db/migrations/001_create_tasks.sql is under db/migrations/. Applied migrations are immutable — editing one silently rewrites history for every existing database. Add a new numbered migration instead; see .claude/skills/add-migration/SKILL.md.
exit code: 2
```

The hook exits with code 2, which Claude Code's PreToolUse contract treats as "deny the tool call" and surfaces the stderr message to the model.

## 2. Live firing from a real Claude session

Headless run (repo root, project `.claude/settings.json` loaded):

```bash
claude -p "Edit the file db/migrations/001_create_tasks.sql: change the title check upper bound from 120 to 200." \
  --permission-mode acceptEdits --output-format json > /tmp/hook-live.json; echo "exit=$?"
# exit=0 (the CLI completed; the Edit attempt itself was denied by the hook)
```

The session attempted the edit and it was denied. From `/tmp/hook-live.json`, `permission_denials` contains the blocked Edit call:

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": ".../db/migrations/001_create_tasks.sql",
    "old_string": "  title      text    not null check (length(title) between 1 and 120),",
    "new_string": "  title      text    not null check (length(title) between 1 and 200),",
    "replace_all": false
  }
}
```

And the session's final result text confirms the block message reached the model:

> "1. Editing `001_create_tasks.sql` (120 → 200) → blocked, told to add a new migration instead."

`git status db/migrations/` is clean after the run — the migration file was not modified.

## Note on hook scope

The live run surfaced a side effect worth a follow-up: the hook denies **any** `Edit`/`Write` under `db/migrations/`, including *creating a brand-new* numbered migration (the nested session's attempt to write `003_task_title_max_200.sql` was also denied, even though the block message tells it to do exactly that). The guard still satisfies its primary purpose — applied migrations cannot be rewritten — but adding new migrations via Claude requires adjusting the hook (e.g. allow writes to files not yet tracked in `schema_migrations`).
