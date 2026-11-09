import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { Record } from "../../../../types/fileBrowserTypes";
import { splitTafToPlaylist, TafSplitResult } from "../../../../utils/playlist/tapApi";
import { DirectoryTreeApi } from "../../common/hooks/useDirectoryTree";

interface UseTafSplitParams {
    path: string;
    /** picks the folder the new folder goes into */
    directoryTree: DirectoryTreeApi;
    mayWrite: (folder: string) => boolean;
    /** file: the split TAF as the list names it */
    onSplit: (result: TafSplitResult, file: string) => void;
}

/** turns a TAF into a folder with one TAF per chapter and a playlist putting them together */
export function useTafSplit({ path, directoryTree, mayWrite, onSplit }: UseTafSplitParams) {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();

    const [tafSplitRecord, setTafSplitRecord] = useState<Record | null>(null);
    const [splitting, setSplitting] = useState(false);

    const trimSlashes = (folder: string) => folder.replace(/^\/+|\/+$/g, "");
    const tafFolder = (record: Record) => {
        const file = `${path}/${record.name}`;
        return trimSlashes(file.slice(0, file.lastIndexOf("/")));
    };
    const target = directoryTree.treeNodeId
        ? trimSlashes(directoryTree.getPathFromNodeId(directoryTree.treeNodeId))
        : null;
    // in the TAF's own folder the original moves into the new folder, elsewhere it stays
    const keepOriginal = !!tafSplitRecord && target !== tafFolder(tafSplitRecord);

    const openTafSplit = (record: Record) => {
        const folder = tafFolder(record);
        if (mayWrite(folder)) {
            directoryTree.selectNodeByFullPath(folder);
        } else {
            directoryTree.setTreeNodeId("");
        }
        setTafSplitRecord(record);
    };
    const closeTafSplit = () => {
        if (!splitting) setTafSplitRecord(null);
    };

    const confirmTafSplit = async () => {
        if (!tafSplitRecord || target === null) return;
        const file = tafSplitRecord.name;
        setSplitting(true);
        try {
            const result = await splitTafToPlaylist(
                `${path}/${file}`,
                [],
                keepOriginal ? target : undefined,
            );
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
            onSplit(result, file);
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

    return {
        tafSplitRecord,
        splitting,
        target,
        keepOriginal,
        openTafSplit,
        closeTafSplit,
        confirmTafSplit,
    };
}
