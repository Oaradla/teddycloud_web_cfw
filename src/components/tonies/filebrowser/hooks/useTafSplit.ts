import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { Record } from "../../../../types/fileBrowserTypes";
import { splitTafToPlaylist, TafSplitResult } from "../../../../utils/playlist/tapApi";

interface UseTafSplitParams {
    path: string;
    onSplit: (result: TafSplitResult) => void;
}

/** turns a TAF into a folder with one TAF per chapter and a playlist putting them together */
export function useTafSplit({ path, onSplit }: UseTafSplitParams) {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();

    const [tafSplitRecord, setTafSplitRecord] = useState<Record | null>(null);
    const [splitting, setSplitting] = useState(false);

    const openTafSplit = (record: Record) => setTafSplitRecord(record);
    const closeTafSplit = () => {
        if (!splitting) setTafSplitRecord(null);
    };

    const confirmTafSplit = async () => {
        if (!tafSplitRecord) return;
        const file = tafSplitRecord.name;
        setSplitting(true);
        try {
            const result = await splitTafToPlaylist(`${path}/${file}`);
            addNotification(
                NotificationTypeEnum.Success,
                t("fileBrowser.tafSplit.success"),
                t("fileBrowser.tafSplit.successDetails", {
                    file,
                    count: result.chapters,
                    folder: "/" + result.folder,
                }),
                t("fileBrowser.title"),
            );
            setTafSplitRecord(null);
            onSplit(result);
        } catch (err: any) {
            addNotification(
                NotificationTypeEnum.Error,
                t("fileBrowser.tafSplit.failed"),
                t("fileBrowser.tafSplit.failedDetails", { file }) + " " + (err?.message ?? err),
                t("fileBrowser.title"),
            );
        } finally {
            setSplitting(false);
        }
    };

    return { tafSplitRecord, splitting, openTafSplit, closeTafSplit, confirmTafSplit };
}
