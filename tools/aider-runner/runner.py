#!/usr/bin/env python3
"""Run aider on work items delegated from Plane's "Delegate to aider" button.

The button creates a queued AiderJob in Plane. This runner polls Plane for
queued jobs, claims one, and:

  1. makes a git worktree on a fresh branch in the repo mapped to the project,
  2. runs aider non-interactively (output streams live to this terminal),
  3. pushes the branch and opens a PR with `gh`,
  4. writes status / PR link back to the job and comments on the work item.

It only makes outbound calls, so it runs fine on a laptop. Stdlib only.
"""

import html
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path

log = logging.getLogger("aider-runner")

CONFIG = tomllib.loads(Path(os.environ.get("AIDER_RUNNER_CONFIG", Path(__file__).with_name("config.toml"))).read_text())
PLANE = CONFIG["plane"]
AIDER = CONFIG.get("aider", {})
PLANE_API_KEY = os.environ["PLANE_API_KEY"]


# --- Plane API -------------------------------------------------------------


def plane(method: str, path: str, body: dict | None = None) -> dict | list:
    req = urllib.request.Request(
        f"{PLANE['api_url'].rstrip('/')}/api/v1/{path.lstrip('/')}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-API-Key": PLANE_API_KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else {}


def update_job(job: dict, **fields) -> None:
    try:
        plane("PATCH", f"workspaces/{job['workspace_slug']}/aider-jobs/{job['id']}/", fields)
    except Exception:
        log.exception("could not update job %s", job["id"])


def comment(job: dict, text_html: str) -> None:
    path = f"workspaces/{job['workspace_slug']}/projects/{job['project']}/work-items/{job['issue']}/comments/"
    try:
        plane("POST", path, {"comment_html": text_html})
    except Exception:
        log.exception("could not comment on %s", job["key"])


# --- git / aider / gh ------------------------------------------------------


def run(cmd: list[str], cwd: str | Path, timeout: int = 600) -> str:
    log.info("$ %s", " ".join(cmd[:5]))
    out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if out.returncode != 0:
        raise RuntimeError(f"{cmd[0]} {cmd[1]} failed ({out.returncode}):\n{(out.stderr or out.stdout)[-2000:]}")
    return out.stdout.strip()


def run_live(cmd: list[str], cwd: Path, timeout: int) -> str:
    """Run a command with its output streamed to this terminal. Returns the tail."""
    tail: deque[str] = deque(maxlen=200)
    started = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    assert proc.stdout
    for line in proc.stdout:
        sys.stdout.write(f"  │ {line}")
        sys.stdout.flush()
        tail.append(line)
        if time.monotonic() - started > timeout:
            proc.kill()
            raise RuntimeError(f"{cmd[0]} timed out after {timeout}s")
    if proc.wait() != 0:
        raise RuntimeError(f"{cmd[0]} exited {proc.returncode}:\n{''.join(tail)[-2000:]}")
    return "".join(tail)


def build_prompt(job: dict) -> str:
    prompt = (
        f"Fix this bug from our tracker ({job['key']}).\n\n"
        f"Title: {job['name']}\n\n"
        f"Description:\n{job['description'].strip() or '(no description)'}\n\n"
    )
    if job["instructions"]:
        prompt += f"Extra instructions from {job['requested_by'] or 'the reporter'}:\n{job['instructions']}\n\n"
    return prompt + (
        "Find the cause and make the smallest correct fix. "
        "Add or update a test if the repo has tests for this area. "
        "Do not change unrelated code."
    )


def delegate(job: dict, repo_cfg: dict) -> None:
    key = job["key"]
    repo = Path(repo_cfg["path"]).expanduser()
    base = repo_cfg.get("base_branch", "main")
    slug = re.sub(r"[^a-z0-9]+", "-", job["name"].lower()).strip("-")[:40]
    branch = f"aider/{key.lower()}-{slug}"
    worktree = Path(CONFIG.get("worktree_root", "~/.aider-worktrees")).expanduser() / repo.name / key.lower()
    web_url = f"{PLANE.get('web_url', PLANE['api_url']).rstrip('/')}/{job['workspace_slug']}/browse/{key}/"

    update_job(job, branch=branch)
    comment(job, f"<p>🤖 aider started on branch <code>{html.escape(branch)}</code>.</p>")

    run(["git", "fetch", "origin", base], repo)
    if worktree.exists():
        run(["git", "worktree", "remove", "--force", str(worktree)], repo)
    worktree.parent.mkdir(parents=True, exist_ok=True)
    run(["git", "worktree", "add", "-B", branch, str(worktree), f"origin/{base}"], repo)
    log.info("worktree: %s", worktree)

    try:
        aider_cmd = [
            "aider",
            "--yes-always",
            "--no-check-update",
            "--no-show-model-warnings",
            "--no-pretty",
            "--no-stream",
            "--auto-commits",
            "--message",
            build_prompt(job),
        ]
        if AIDER.get("model"):
            aider_cmd += ["--model", AIDER["model"]]
        aider_cmd += AIDER.get("extra_args", [])
        aider_out = run_live(aider_cmd, worktree, timeout=AIDER.get("timeout_seconds", 1800))

        ahead = int(run(["git", "rev-list", "--count", f"origin/{base}..HEAD"], worktree))
        if ahead == 0:
            update_job(job, status="failed", error="aider made no commits")
            comment(job, "<p>🤖 aider finished but made no changes. No PR opened.</p>")
            return

        run(["git", "push", "--force-with-lease", "-u", "origin", branch], worktree)
        instructions = f"### Extra instructions\n{job['instructions']}\n\n" if job["instructions"] else ""
        body = (
            f"Resolves Plane work item [{key}]({web_url}).\n\n"
            f"### Bug\n{job['name']}\n\n{instructions}"
            f"### aider log (tail)\n```\n{aider_out[-3000:]}\n```\n\n"
            "_Opened automatically by aider-runner. Review before merging._"
        )
        pr_url = run(
            ["gh", "pr", "create", "--base", base, "--head", branch, "--title", f"[{key}] {job['name']}", "--body", body],
            worktree,
        ).splitlines()[-1]
        update_job(job, status="done", pr_url=pr_url)
        comment(job, f'<p>🤖 aider opened a PR: <a href="{html.escape(pr_url)}">{html.escape(pr_url)}</a></p>')
        log.info("PR: %s", pr_url)
    finally:
        # The branch lives on in origin; the local checkout is disposable.
        subprocess.run(["git", "worktree", "remove", "--force", str(worktree)], cwd=repo, capture_output=True)


# --- queue -----------------------------------------------------------------


def process(job: dict) -> None:
    job["key"] = f"{job['project_identifier']}-{job['sequence_id']}"
    repo_cfg = CONFIG.get("projects", {}).get(job["project_identifier"])

    try:
        job.update(plane("POST", f"workspaces/{job['workspace_slug']}/aider-jobs/{job['id']}/claim/"))
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            return  # someone else claimed it
        raise

    log.info("━━ %s: %s", job["key"], job["name"])
    if not repo_cfg:
        msg = f"Project {job['project_identifier']} has no repo in the aider-runner config."
        update_job(job, status="failed", error=msg)
        comment(job, f"<p>🤖 {html.escape(msg)}</p>")
        log.error(msg)
        return

    try:
        delegate(job, repo_cfg)
    except Exception as exc:
        log.exception("%s failed", job["key"])
        update_job(job, status="failed", error=str(exc)[-4000:])
        comment(job, f"<p>🤖 aider-runner failed:</p><pre>{html.escape(str(exc)[-1500:])}</pre>")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    for tool in ("git", "aider", "gh"):
        if not shutil.which(tool):
            sys.exit(f"{tool} is not on PATH")

    workspaces = PLANE["workspaces"]
    poll = CONFIG.get("poll_seconds", 10)
    log.info("polling %s every %ss for aider jobs", ", ".join(workspaces), poll)
    while True:
        for slug in workspaces:
            try:
                jobs = plane("GET", f"workspaces/{slug}/aider-jobs/?status=queued")
            except Exception as exc:
                log.warning("poll %s failed: %s", slug, exc)
                continue
            for job in jobs:
                process(job)  # one at a time: aider runs are heavy and share repos
        time.sleep(poll)


if __name__ == "__main__":
    main()
