import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { buildTap } from "../../../../utils/playlist/tapApi";

const api = new TeddyCloudApi(defaultAPIConfig());

type UseTapEditorArgs = {
    currentPath: string;
    setRebuildList: React.Dispatch<React.SetStateAction<boolean>>;
};

const ensureLeadingSlash = (p: string) => (p.startsWith("/") ? p : `/${p}`);
const isTap = (p: string) => (p ?? "").toLowerCase().endsWith(".tap");

export const useTapEditor = ({ currentPath, setRebuildList }: UseTapEditorArgs) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();

    const [isTapEditorModalOpen, setIsTapEditorModalOpen] = useState(false);
    const [currentFile, setCurrentFile] = useState<string>(""); // relative file path coming from table, e.g. "foo.tap" or "/foo.tap"

    const normalizedCurrentPath = useMemo(
        () => (currentPath.startsWith("/") ? currentPath : `/${currentPath}`),
        [currentPath],
    );

    const initialValuesPath = useMemo(() => {
        if (!currentFile) return undefined;
        const normalizedFile = ensureLeadingSlash(currentFile);
        return `/library${normalizedFile}`;
    }, [currentFile]);

    const openCreateTap = useCallback(() => {
        setCurrentFile("");
        setIsTapEditorModalOpen(true);
    }, []);

    const openEditTap = useCallback((file: string) => {
        if (!isTap(file)) return;
        setCurrentFile(file);
        setIsTapEditorModalOpen(true);
    }, []);

    const closeTapEditor = useCallback(() => {
        setIsTapEditorModalOpen(false);
        setCurrentFile("");
    }, []);

    const onTapCreateOrSave = useCallback(
        async (values: any) => {
            try {
                const safeName =
                    (values.name ?? "")
                        .trim()
                        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
                        .replace(/[. ]+$/g, "") || "untitled";

                // an edited playlist keeps its file, a new one is named after the playlist
                const editedFile = currentFile ? ensureLeadingSlash(currentFile) : "";
                const fileName = editedFile ? editedFile.split("/").pop()! : `${safeName}.tap`;
                const dir = editedFile
                    ? editedFile.slice(0, editedFile.lastIndexOf("/")) || "/"
                    : normalizedCurrentPath;

                const tap = {
                    type: "tap",
                    audio_id: Number(values.audio_id) || 0,
                    filepath: values.filepath,
                    name: values.name,
                    files: (values.files ?? []).map((f: any) => ({
                        filepath: f.filepath,
                        name: f.name,
                    })),
                };
                const json = JSON.stringify(tap, null, 2);
                const file = new File([json], fileName, { type: "application/json" });

                const formData = new FormData();
                formData.append(fileName, file);

                const response = await api.apiPostTeddyCloudFormDataRaw(
                    `/api/fileUpload?path=${encodeURIComponent(dir)}&special=library`,
                    formData,
                );

                if (!response.ok) {
                    const msg = await response.text().catch(() => "");
                    throw new Error(`Upload failed (${response.status}): ${msg}`);
                }

                // put the playlist TAF together right away (TAF files) or tell when it happens
                let buildMessage = "";
                try {
                    const result = await buildTap(`${dir.replace(/\/+$/, "")}/${fileName}`);
                    buildMessage = result.built
                        ? t("fileBrowser.tap.messages.built")
                        : t("fileBrowser.tap.messages.encodedOnPlayback");
                } catch (err: any) {
                    addNotification(
                        NotificationTypeEnum.Warning,
                        t("fileBrowser.tap.messages.buildFailed"),
                        t("fileBrowser.tap.messages.buildFailedDetails", { file: fileName }) +
                            ` ${err?.message || ""}`,
                        t("fileBrowser.title"),
                    );
                }

                setIsTapEditorModalOpen(false);

                addNotification(
                    NotificationTypeEnum.Success,
                    t("fileBrowser.tap.messages.savedSuccessfully"),
                    t("fileBrowser.tap.messages.savedSuccessfullyDetails", {
                        file: fileName,
                        path: dir || "/",
                    }) + (buildMessage ? ` ${buildMessage}` : ""),
                    t("fileBrowser.title"),
                );

                setRebuildList((prev) => !prev);
            } catch (err: any) {
                addNotification(
                    NotificationTypeEnum.Warning,
                    t("fileBrowser.tap.messages.savingFailed"),
                    t("fileBrowser.tap.messages.savingFailedDetails", {
                        file: `${values?.name || "unknown"}.tap`,
                        path: currentPath || "/",
                    }) + ` ${err?.message || ""}`,
                    t("fileBrowser.title"),
                );
            }
        },
        [addNotification, currentFile, currentPath, normalizedCurrentPath, setRebuildList, t],
    );

    return {
        isTapEditorModalOpen,
        currentFile,
        initialValuesPath,
        currentPath,

        openCreateTap,
        openEditTap,
        closeTapEditor,
        onTapCreateOrSave,
    };
};
