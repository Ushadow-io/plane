# aider-runner

Click **Delegate to aider** (robot icon) on a Plane work item. Type extra instructions if you want. This runner picks up the job, fixes the bug in a git worktree, and opens a PR.

## How it fits

```
Plane button ──► AiderJob row (queued)
                     ▲
runner (your Mac) ── polls /api/v1/workspaces/<slug>/aider-jobs/?status=queued
                  ── claims job → worktree → aider → push → gh pr create
                  ── writes status + PR link back, comments on the work item
```

The runner only makes outbound calls. It can move into the cluster later with no Plane change.

## Set up

1. `cp config.example.toml config.toml`
2. Set `workspaces`, and map each project identifier (e.g. `PSY`) to a local clone.
3. Run:

   ```sh
   export PLANE_API_KEY=... ANTHROPIC_API_KEY=...
   python3 runner.py
   ```

Needs `git`, `aider` and an authenticated `gh` on PATH. The API token must belong to a workspace admin.

aider output streams live into the terminal.

## What happens per job

- Comment "aider started on branch …".
- `git worktree add -B aider/<key>-<title> ~/.aider-worktrees/<repo>/<key> origin/<base>`
- `aider --yes-always --message "<title + description + your instructions>"`
- If aider made commits: push, `gh pr create`, save PR link, comment it.
- Remove the worktree. The branch stays on origin.

A job stuck in `running` (runner crashed) stops blocking the button after 2 hours.
