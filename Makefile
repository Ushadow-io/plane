# Deploy shortcuts for working inside the fork.
#
# This is a thin delegation to the chakra monorepo, NOT a second copy of the
# deploy logic. Duplicating it would guarantee drift: the tag derivation, the
# registry split (push over Tailscale, pull from ra:32000) and the pre-upgrade
# migration hook all live in chakra-plexus/Makefile and must stay in one place.
#
# Upstream Plane ships no Makefile, so this file is purely additive and will not
# conflict when merging from upstream/preview.
#
# Only works inside the monorepo checkout -- the fork cloned on its own has no
# charts, no cluster credentials and nothing to deploy to.

# The monorepo root, discovered rather than hardcoded, so this keeps working
# from a git worktree or a relocated checkout.
CHAKRA_ROOT := $(shell git rev-parse --show-superproject-working-tree 2>/dev/null)

.PHONY: help guard-root deploy build push rollback status logs check

help: ## Show available targets
	@echo "Deploy targets (delegate to the chakra monorepo):"
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Full deploy is: make deploy"

# Fails loudly rather than emitting a confusing "No rule to make target" from
# a make invoked against an empty directory.
guard-root:
	@if [ -z "$(CHAKRA_ROOT)" ]; then \
		echo "Error: not inside the chakra monorepo checkout."; \
		echo "These targets deploy via chakra-plexus/Makefile, which is not present"; \
		echo "in a standalone clone of this fork."; \
		exit 1; \
	fi

deploy: guard-root ## Build, push and deploy this fork to the cluster
	@echo "Deploying $$(git rev-parse --short=10 HEAD) via $(CHAKRA_ROOT)"
	@$(MAKE) -C "$(CHAKRA_ROOT)" plexus-plane-redeploy

build: guard-root ## Build the backend + frontend images only (no push, no deploy)
	@$(MAKE) -C "$(CHAKRA_ROOT)" plexus-plane-build

push: guard-root ## Push already-built images to the registry
	@$(MAKE) -C "$(CHAKRA_ROOT)" plexus-plane-push

check: guard-root ## Report whether the working tree is clean (warn only, never blocks)
	@$(MAKE) -C "$(CHAKRA_ROOT)" plexus-plane-check-clean

rollback: guard-root ## Roll the cluster back one helm revision (does NOT revert the DB)
	@$(MAKE) -C "$(CHAKRA_ROOT)" plexus-plane-rollback

status: guard-root ## Show deployed revision, image tags and pod state
	@helm history plane -n chakra-plexus 2>/dev/null | tail -3
	@echo
	@kubectl get pods -n chakra-plexus -l app.kubernetes.io/part-of=plane \
		-o custom-columns='NAME:.metadata.name,READY:.status.containerStatuses[0].ready,IMAGE:.spec.containers[0].image' 2>/dev/null

logs: guard-root ## Tail the API logs
	@kubectl logs -n chakra-plexus -l app=api,app.kubernetes.io/part-of=plane -f --tail=100
