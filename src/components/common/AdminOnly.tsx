import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAcl } from "../../provider/AclProvider";

/** Pages for admins only; other users are sent to a page they can use. */
export const AdminOnly = ({ children, fallback }: { children: ReactNode; fallback: string }) => {
    const acl = useAcl();
    if (!acl.loaded) {
        return null;
    }
    return acl.admin ? <>{children}</> : <Navigate to={fallback} replace />;
};
