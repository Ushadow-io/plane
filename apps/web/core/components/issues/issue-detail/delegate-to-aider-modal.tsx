/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalWidth, ModalCore, TextArea } from "@plane/ui";
import type { TAiderJob } from "@/services/aider.service";
import { AiderService } from "@/services/aider.service";

const aiderService = new AiderService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

const STATUS_TEXT: Record<TAiderJob["status"], string> = {
  queued: "Waiting for the runner to pick it up",
  running: "aider is working on it",
  done: "Finished",
  failed: "Failed",
};

export const DelegateToAiderModal = observer(function DelegateToAiderModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, issueId } = props;
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastJob, setLastJob] = useState<TAiderJob | undefined>();

  useEffect(() => {
    if (!isOpen) return;
    setInstructions("");
    aiderService
      .listJobs(workspaceSlug, projectId, issueId)
      .then((jobs) => setLastJob(jobs[0]))
      .catch(() => setLastJob(undefined));
  }, [isOpen, workspaceSlug, projectId, issueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await aiderService.delegate(workspaceSlug, projectId, issueId, instructions);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Sent to aider",
        message: "The runner will comment here when it starts and when the PR is open.",
      });
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not delegate",
        message: (error as { error?: string })?.error ?? "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // pr_url is written by the runner's API token; never render a non-https href.
  const prHref = lastJob?.pr_url && /^https:\/\//i.test(lastJob.pr_url) ? lastJob.pr_url : undefined;

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.XL}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <h3 className="text-18 font-medium text-primary">Delegate to aider</h3>
          <p className="mt-1 text-13 text-secondary">
            aider gets the title and description. It fixes the bug on a new branch and opens a PR.
          </p>
        </div>
        {lastJob && (
          <div className="rounded-md border border-subtle px-3 py-2 text-13 text-secondary">
            Last run: <span className="font-medium text-primary">{STATUS_TEXT[lastJob.status]}</span>
            {prHref && (
              <>
                {" · "}
                <a href={prHref} target="_blank" rel="noopener noreferrer" className="underline">
                  Pull request
                </a>
              </>
            )}
          </div>
        )}
        <TextArea
          name="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Extra instructions (optional). For example: the bug is in the login form; add a test."
          className="min-h-32 w-full resize-y text-14"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="lg" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" type="submit" loading={isSubmitting}>
            {isSubmitting ? "Sending" : "Send to aider"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
