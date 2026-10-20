import React from "react";
import { useTranslation } from "react-i18next";
import { Modal, Typography } from "antd";

import { Record } from "../../../../types/fileBrowserTypes";

const { Paragraph } = Typography;

interface TafSplitModalProps {
    record: Record | null;
    splitting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const TafSplitModal: React.FC<TafSplitModalProps> = ({
    record,
    splitting,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const name = record?.name ?? "";
    const folder = name.replace(/\.taf$/i, "");
    const chapters = record?.tafHeader?.trackSeconds?.length;

    return (
        <Modal
            open={!!record}
            title={t("fileBrowser.tafSplit.title", { file: name })}
            okText={t("fileBrowser.tafSplit.confirm")}
            cancelText={t("fileBrowser.tafSplit.cancel")}
            onOk={onConfirm}
            onCancel={onCancel}
            confirmLoading={splitting}
            cancelButtonProps={{ disabled: splitting }}
        >
            <Paragraph>
                {chapters
                    ? t("fileBrowser.tafSplit.descriptionCount", { count: chapters, folder })
                    : t("fileBrowser.tafSplit.description", { folder })}
            </Paragraph>
            <Paragraph>
                {t("fileBrowser.tafSplit.originalStays", {
                    file: name,
                    playlist: `${folder}.tap.taf`,
                })}
            </Paragraph>
        </Modal>
    );
};

export default TafSplitModal;
