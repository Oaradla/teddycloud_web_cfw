import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Typography } from "antd";

import { DirectoryTreeSelect } from "../../common/elements/DirectoryTreeSelect";
import { useDirectoryTree } from "../../common/hooks/useDirectoryTree";

const { Paragraph } = Typography;

/** picks a library folder; its TAFs and playlists (also below it) go onto the sheet */
export const AddFolderModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onConfirm: (path: string) => Promise<void>;
}> = ({ open, onClose, onConfirm }) => {
    const { t } = useTranslation();
    const directoryTree = useDirectoryTree("library");
    const [busy, setBusy] = useState(false);

    return (
        <Modal
            open={open}
            title={t("tonies.teddystudio.addFolder.title")}
            okText={t("tonies.teddystudio.addFolder.confirm")}
            cancelText={t("tonies.teddystudio.addFolder.cancel")}
            confirmLoading={busy}
            onCancel={onClose}
            onOk={async () => {
                setBusy(true);
                try {
                    await onConfirm(directoryTree.getPathFromNodeId(directoryTree.treeNodeId));
                    onClose();
                } finally {
                    setBusy(false);
                }
            }}
        >
            <Paragraph>{t("tonies.teddystudio.addFolder.text")}</Paragraph>
            <DirectoryTreeSelect directoryTree={directoryTree} style={{ width: "100%" }} />
        </Modal>
    );
};
