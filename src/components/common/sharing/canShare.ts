import type { AclScope } from "../../../utils/auth/aclApi";

type ShareAcl = {
    loginActive: boolean;
    admin: boolean;
    can: (scope: AclScope, id: string, right: string) => boolean;
    owns: (scope: AclScope, id: string) => boolean;
};

/** Admins and owners with the share right may share, and only with login. */
export function canShare(acl: ShareAcl, type: AclScope, id: string): boolean {
    return (
        acl.loginActive && (acl.admin || (acl.owns(type, id) && acl.can(type, id, `${type}.share`)))
    );
}
