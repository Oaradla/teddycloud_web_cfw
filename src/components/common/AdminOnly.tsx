import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAcl } from "../../provider/AclProvider";

/** Pages for admins (or whom `allow` lets in); other users are sent to a page they can use. */
export const AdminOnly = ({
    children,
    fallback,
    allow,
}: {
    children: ReactNode;
    fallback: string;
    allow?: (acl: ReturnType<typeof useAcl>) => boolean;
}) => {
    const acl = useAcl();
    if (!acl.loaded) {
        return null;
    }
    return acl.admin || allow?.(acl) ? <>{children}</> : <Navigate to={fallback} replace />;
};
