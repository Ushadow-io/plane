/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import { useParams } from "react-router";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ReleaseModal } from "@/components/releases";
import { useUserPermissions } from "@/hooks/store/user";

export const ReleasesHeader = observer(function ReleasesHeader() {
  const { workspaceSlug } = useParams();
  const { allowPermissions } = useUserPermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <>
      <Header>
        <Header.LeftItem>
          <Breadcrumbs>
            <Breadcrumbs.Item component={<BreadcrumbLink label="Releases" />} />
          </Breadcrumbs>
        </Header.LeftItem>
        {canCreate && (
          <Header.RightItem>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
              Add release
            </Button>
          </Header.RightItem>
        )}
      </Header>

      <ReleaseModal
        isOpen={isModalOpen}
        workspaceSlug={workspaceSlug?.toString() ?? ""}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
});
