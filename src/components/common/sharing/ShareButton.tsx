import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "antd";
import { ShareAltOutlined, TeamOutlined } from "@ant-design/icons";

import { useAcl } from "../../../provider/AclProvider";
import type { AclScope } from "../../../utils/auth/aclApi";
import { canShare } from "./canShare";
import { ShareDialog } from "./ShareDialog";

/** Opens the share dialog (owners of boxes and tonies); renders nothing for users who may not share (see canShare). */
export const ShareButton = ({
    type,
    id,
    title,
    size,
}: {
    type: AclScope;
    id: string;
    title: string;
    size?: "small" | "middle";
}) => {
    const { t } = useTranslation();
    const acl = useAcl();
    const [open, setOpen] = useState(false);
    if (!canShare(acl, type, id)) {
        return null;
    }
    // boxes and tonies are not shared, they get owners
    const label = t(type === "folder" ? "sharing.button" : "sharing.ownersButton");
    return (
        <>
            <Tooltip title={label}>
                <Button
                    type="text"
                    size={size}
                    icon={type === "folder" ? <ShareAltOutlined /> : <TeamOutlined />}
                    aria-label={label}
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(true);
                    }}
                />
            </Tooltip>
            {open ? (
                <ShareDialog
                    open={open}
                    type={type}
                    id={id}
                    title={title}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    );
};
