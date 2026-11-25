// owner: @garnaga · why: an agent edited the applied 002 migration instead of adding 003, silently rewriting history for every existing DB · review-by: 2027-02-25
// PreToolUse hook: blocks Edit/Write/MultiEdit/NotebookEdit on files under db/migrations/.
// Exit 0 = allow, exit 2 = block (stderr is shown to the model as the reason).
// Fail open: malformed stdin must never block a tool call.

import { createInterface } from 'node:readline';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const PROTECTED_PREFIX = 'db/migrations/';

let raw = '';
for await (const chunk of createInterface({ input: process.stdin })) {
  raw += chunk;
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // fail open
}

const toolName = typeof payload?.tool_name === 'string' ? payload.tool_name : '';
const filePath = typeof payload?.tool_input?.file_path === 'string' ? payload.tool_input.file_path : '';

if (!EDIT_TOOLS.has(toolName) || !filePath) {
  process.exit(0);
}

// Normalize: strip backslashes, a leading repo-root prefix (Claude Code often
// passes absolute paths), and leading ./ or / so every spelling of a
// db/migrations/ path is caught.
let normalized = filePath.replace(/\\/g, '/');
const cwdPrefix = process.cwd() + '/';
if (normalized.startsWith(cwdPrefix)) {
  normalized = normalized.slice(cwdPrefix.length);
}
normalized = normalized.replace(/^\.{1,2}\//, '').replace(/^\//, '');

if (normalized.startsWith(PROTECTED_PREFIX)) {
  process.stderr.write(
    `BLOCKED: ${filePath} is under db/migrations/. Applied migrations are immutable — ` +
      'editing one silently rewrites history for every existing database. ' +
      'Add a new numbered migration instead; see .claude/skills/add-migration/SKILL.md.\n'
  );
  process.exit(2);
}

process.exit(0);
