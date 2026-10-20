import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, type InputRef, type TreeSelectProps, type UploadProps } from "antd";
import type { DragEndEvent } from "@dnd-kit/core";
import { PointerSensor, useSensor } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { MAX_FILES } from "../../../../constants/numbers";
import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { MyUploadFile, upload as encoderUpload } from "../../../../utils/audio/audioEncoder";
import {
    isInputValid,
    INVALID_NAME_CHARS_DISPLAY as invalidCharactersAsString,
} from "../../../../utils/validation/fieldInputValidator";
import { ffmpegSupportedExtensions } from "../../../../utils/files/ffmpegSupportedExtensions";
import { createQueryString } from "../../../../utils/browser/queryParams";
import {
    loadWasmEncoder,
    isWasmEncoderAvailable,
    WasmTafEncoder,
} from "../../../../utils/audio/wasmEncoder";
import { useDirectoryTree } from "../../common/hooks/useDirectoryTree";
import { splitTafToPlaylist } from "../../../../utils/playlist/tapApi";
import { CoverInfo, languageOf, saveCoverModel, TafHeader, trackTitle } from "../utils/coverModel";
import {
    Encoder,
    hasTapBuild,
    PartsStep,
    uploadInParts,
} from "../../../../utils/audio/partsUpload";

const api = new TeddyCloudApi(defaultAPIConfig());

const noCover: CoverInfo = { cover: null, series: "", episodes: "" };

export const useEncoder = () => {
    const { t, i18n } = useTranslation();
    const { addNotification, addLoadingNotification, closeLoadingNotification } = useTeddyCloud();

    const [debugPCMObjects, setDebugPCMObjects] = useState(false);
    const [useFrontendEncoding, setUseFrontendEncoding] = useState(false);
    const [useFrontendEncodingSetting, setUseFrontendEncodingSetting] = useState(false);
    const [wasmLoaded, setWasmLoaded] = useState(false);
    const [bitrate, setBitrate] = useState(96);

    const [fileList, setFileList] = useState<MyUploadFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [tafFilename, setTafFilename] = useState("");
    // every file becomes a TAF of its own in a folder, put together by a playlist
    const [splitIntoPlaylist, setSplitIntoPlaylist] = useState(false);

    const [isCreateDirectoryModalOpen, setCreateDirectoryModalOpen] = useState(false);
    const [createDirectoryPath, setCreateDirectoryPath] = useState<string>("");
    const [rebuildList, setRebuildList] = useState<boolean>(false);

    const [hasInvalidChars, setHasInvalidChars] = useState(false);

    const [coverEnabled, setCoverEnabled] = useState(false);
    const [coverInfo, setCoverInfo] = useState<CoverInfo>(noCover);

    const inputRef = useRef<InputRef>(null);

    // -------------------------------------------------
    // Initial Settings + Tree preload
    // -------------------------------------------------

    useEffect(() => {
        const fetchDebugPCM = async () => {
            try {
                const response = await api.apiGetTeddyCloudSettingRaw(
                    "debug.web.pcm_encode_console_url",
                );
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setDebugPCMObjects(data.toString() === "true");
            } catch (error) {
                console.error("Error fetching debug.web.pcm_encode_console_url: ", error);
            }
        };

        const fetchUseFrontendSetting = async () => {
            try {
                const response = await api.apiGetTeddyCloudSettingRaw("encode.use_frontend");
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const useFrontend = data.toString() === "true";
                setUseFrontendEncodingSetting(useFrontend);
                setUseFrontendEncoding(useFrontend);

                if (useFrontend) {
                    loadWasmEncoder()
                        .then(() => {
                            setWasmLoaded(true);
                            console.log("WASM encoder pre-loaded");
                        })
                        .catch((error) => {
                            console.error("Failed to pre-load WASM encoder:", error);
                        });
                }
            } catch (error) {
                console.error("Error fetching encode.use_frontend: ", error);
            }
        };

        const fetchBitrateSetting = async () => {
            try {
                const response = await api.apiGetTeddyCloudSettingRaw("encode.bitrate");
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const bitrateSetting = parseInt(data.toString(), 10);
                if (!isNaN(bitrateSetting)) setBitrate(bitrateSetting);
            } catch (error) {
                console.error("Error fetching encode.bitrate: ", error);
            }
        };

        fetchDebugPCM();
        fetchUseFrontendSetting();
        fetchBitrateSetting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Autofocus fürs eigene kleine Input-Feld, falls du es nutzen willst
    useEffect(() => {
        if (isCreateDirectoryModalOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    }, [isCreateDirectoryModalOpen]);

    // -------------------------------------------------
    // Tree / Pfade + Helper-Funktionen fürs Modal
    // -------------------------------------------------

    const directoryTree = useDirectoryTree();
    const { treeNodeId, setTreeData, getPathFromNodeId } = directoryTree;

    // -------------------------------------------------
    // Playlist: split the new TAF into one TAF per file
    // -------------------------------------------------

    const finishUpload = async (key: string, tafName: string, titles: string[]) => {
        if (!splitIntoPlaylist || titles.length < 2) {
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.encoder.uploadSuccessful"),
                t("tonies.encoder.uploadSuccessfulDetails", { file: tafName }),
                t("tonies.title"),
            );
            return;
        }
        addLoadingNotification(
            key,
            t("tonies.encoder.processing"),
            t("tonies.encoder.creatingPlaylist"),
        );
        try {
            const dir = getPathFromNodeId(treeNodeId).replace(/\/+$/, "");
            const result = await splitTafToPlaylist(`${dir}/${tafName}`, titles);
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.encoder.uploadSuccessful"),
                t("tonies.encoder.playlistCreatedDetails", {
                    file: tafName,
                    folder: "/" + result.folder,
                    count: result.chapters,
                }),
                t("tonies.title"),
            );
        } catch (err) {
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Warning,
                t("tonies.encoder.playlistFailed"),
                t("tonies.encoder.playlistFailedDetails", { file: tafName }) + " " + err,
                t("tonies.title"),
            );
        }
    };

    const fileTitles = (files: MyUploadFile[]) => files.map((f) => f.name.replace(/\.[^/.]+$/, ""));

    // -------------------------------------------------
    // DnD / Upload-Liste
    // -------------------------------------------------

    const sensor = useSensor(PointerSensor, {
        activationConstraint: { distance: 10 },
    });

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (active.id !== over?.id) {
            setFileList((prev) => {
                const activeIndex = prev.findIndex((i) => i.uid === active.id);
                const overIndex = prev.findIndex((i) => i.uid === over?.id);
                if (activeIndex === -1 || overIndex === -1) return prev;
                return arrayMove(prev, activeIndex, overIndex);
            });
        }
    };

    const onChangeUpload: UploadProps["onChange"] = ({ fileList: newFileList }) => {
        if (newFileList.length > MAX_FILES) {
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.encoder.tooManyFilesError"),
                t("tonies.encoder.maxFiles", { maxFiles: MAX_FILES }),
                t("tonies.title"),
            );
        }

        const updatedFileList = newFileList.slice(0, MAX_FILES) as MyUploadFile[];

        if (updatedFileList.length === 1 && tafFilename === "") {
            const singleFile = updatedFileList[0];
            const fileNameWithoutExtension = singleFile.name.replace(/\.[^/.]+$/, "");
            setTafFilename(fileNameWithoutExtension);
        }

        setFileList(updatedFileList);
    };

    const onRemoveUpload = (file: MyUploadFile) => {
        setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
    };

    const uploadProps: UploadProps = {
        listType: "picture",
        multiple: true,
        accept: ffmpegSupportedExtensions.join(","),
        beforeUpload: (file) => {
            const isAccepted = ffmpegSupportedExtensions.some((ext) =>
                file.name.toLowerCase().endsWith(ext.toLowerCase()),
            );

            if (!isAccepted) {
                addNotification(
                    NotificationTypeEnum.Error,
                    t("tonies.encoder.unsupportedFileType"),
                    t("tonies.encoder.unsupportedFileTypeDetails", { file: file.name }),
                    t("tonies.title"),
                );
                return Upload.LIST_IGNORE;
            }

            const myFile: MyUploadFile = file;
            myFile.file = file;
            setFileList((prev) => [...prev, myFile]);
            return false;
        },
        fileList,
        onChange: onChangeUpload,
    };

    const sortFileListAlphabeticallyLiteral = () => {
        setFileList((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
    };

    const sortFileListAlphabeticallyNatural = () => {
        setFileList((prev) =>
            [...prev].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
            ),
        );
    };

    const clearFileList = () => {
        setFileList([]);
    };

    // -------------------------------------------------
    // Cover and custom model of the new TAF
    // -------------------------------------------------

    /** after a successful encoding: the custom model with the cover, if wanted */
    const saveCover = async (
        dir: string,
        files: MyUploadFile[],
        tafName = tafFilename + ".taf",
        known?: TafHeader,
    ) => {
        if (!coverEnabled) return;
        try {
            const model = await saveCoverModel(
                dir,
                tafName,
                { ...coverInfo, series: coverInfo.series.trim() || tafFilename },
                files.map((f) => trackTitle(f.name)),
                languageOf(i18n.language),
                "library",
                known,
            );
            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.encoder.cover.saved"),
                t("tonies.encoder.cover.savedDetails", { file: tafName, model }),
                t("tonies.title"),
            );
        } catch (err) {
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.encoder.cover.failed"),
                t("tonies.encoder.cover.failedDetails", { file: tafName }) + String(err),
                t("tonies.title"),
            );
        }
        setCoverInfo(noCover);
    };

    // -------------------------------------------------
    // CreateDirectoryModal-Handling
    // -------------------------------------------------

    const openCreateDirectoryModal = () => {
        const currentPath = getPathFromNodeId(treeNodeId); // ohne / am Ende
        setCreateDirectoryPath(currentPath);
        setCreateDirectoryModalOpen(true);
    };

    const closeCreateDirectoryModal = () => {
        setCreateDirectoryModalOpen(false);
    };

    // -------------------------------------------------
    // Filename input
    // -------------------------------------------------

    const handleFileNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setHasInvalidChars(!isInputValid(value));
        setTafFilename(value);
    };

    // -------------------------------------------------
    // Server-side Upload
    // -------------------------------------------------

    // -------------------------------------------------
    // Several files: encoded one by one in parallel, joined by the server
    // -------------------------------------------------

    const stepText = (step: PartsStep) => {
        switch (step.kind) {
            case "encoding":
                return t("tonies.encoder.parts.encoding", { done: step.done, total: step.total });
            case "uploading":
                return t("tonies.encoder.parts.uploading", { done: step.done, total: step.total });
            case "serverEncoding":
                return t("tonies.encoder.parts.serverEncoding", {
                    done: step.done,
                    total: step.total,
                });
            default:
                return t("tonies.encoder.parts.joining");
        }
    };

    /** the fast way for several files; false when the server cannot join TAFs (then the old way) */
    const uploadParts = async (encoder: Encoder) => {
        if (fileList.length < 2 || !(await hasTapBuild())) return false;
        const files = fileList;
        const name = tafFilename;
        const key = "encoding-" + name + ".taf";
        setUploading(true);
        setProcessing(true);
        const job = {
            files: files.map((f) => f.file as File),
            // "01 - Intro.mp3" -> "Intro": the parts are numbered anyway
            titles: files.map((f) => trackTitle(f.name)),
            name,
            folder: getPathFromNodeId(treeNodeId),
            playlist: splitIntoPlaylist,
            encoder,
            bitrate,
        };
        const step = (s: PartsStep, fraction: number) =>
            addLoadingNotification(
                key,
                t("tonies.encoder.processing"),
                `${stepText(s)} (${Math.round(fraction * 100)} %)`,
            );
        try {
            let result;
            try {
                result = await uploadInParts(job, step);
            } catch (err) {
                if (encoder === "server") throw err;
                // the browser could not encode (old browser, no memory): the server does it
                addNotification(
                    NotificationTypeEnum.Info,
                    t("tonies.encoder.parts.browserFailed"),
                    String(err),
                    t("tonies.title"),
                );
                result = await uploadInParts({ ...job, encoder: "server" }, step);
            }
            await saveCover(
                result.folder,
                files,
                result.tafName,
                result.header && {
                    ...result.header,
                    alsoAudioIds: result.tapAudioId ? [result.tapAudioId] : [],
                },
            );
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.encoder.uploadSuccessful"),
                splitIntoPlaylist
                    ? t("tonies.encoder.parts.playlistCreated", {
                          file: result.source,
                          count: files.length,
                      })
                    : t("tonies.encoder.uploadSuccessfulDetails", { file: name + ".taf" }),
                t("tonies.title"),
            );
            setFileList([]);
            setTafFilename("");
        } catch (err) {
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.encoder.uploadFailed"),
                t("tonies.encoder.uploadFailedDetails") + err,
                t("tonies.title"),
            );
        } finally {
            setProcessing(false);
            setUploading(false);
        }
        return true;
    };

    const handleUpload = async () => {
        if (await uploadParts("server")) return;
        setUploading(true);
        const formData = new FormData();
        const key = "encoding-" + tafFilename + ".taf";

        addLoadingNotification(key, t("tonies.encoder.uploading"), t("tonies.encoder.uploading"));

        for (const file of fileList) {
            addLoadingNotification(
                key,
                t("tonies.encoder.uploading"),
                t("tonies.encoder.uploadingDetails", { file: file.name }),
            );
            try {
                await new Promise<void>((resolve, reject) =>
                    (encoderUpload as any)(
                        resolve,
                        reject,
                        formData,
                        fileList,
                        file,
                        debugPCMObjects,
                    ),
                );
            } catch (error) {
                addNotification(
                    NotificationTypeEnum.Error,
                    t("tonies.encoder.processingError"),
                    t("tonies.encoder.errorFileProcessing") + error,
                    t("tonies.title"),
                );
                closeLoadingNotification(key);
                setUploading(false);
                return;
            }
        }

        const currentUnixTime = Math.floor(Date.now() / 1000);
        const queryParams = {
            name: tafFilename + ".taf",
            audioId: currentUnixTime - 0x50000000,
            path: getPathFromNodeId(treeNodeId),
            special: "library",
        };

        setProcessing(true);
        const queryString = createQueryString(queryParams);

        try {
            addLoadingNotification(
                key,
                t("tonies.encoder.processing"),
                t("tonies.encoder.processingDetails", { file: tafFilename + ".taf" }),
            );
            const response = await api.apiPostTeddyCloudFormDataRaw(
                `/api/pcmUpload?${queryString}`,
                formData,
            );
            if (response.ok) {
                // before a split moves the TAF into its folder
                await saveCover(queryParams.path, fileList);
                await finishUpload(key, tafFilename + ".taf", fileTitles(fileList));
                setFileList([]);
                setTafFilename("");
            } else {
                closeLoadingNotification(key);
                addNotification(
                    NotificationTypeEnum.Error,
                    t("tonies.encoder.uploadFailed"),
                    t("tonies.encoder.uploadFailedDetails") + response.statusText,
                    t("tonies.title"),
                );
            }
        } catch (err) {
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.encoder.uploadFailed"),
                t("tonies.encoder.uploadFailedDetails") + err,
                t("tonies.title"),
            );
        } finally {
            setProcessing(false);
            setUploading(false);
        }
    };

    // -------------------------------------------------
    // Browser-side (WASM) Upload
    // -------------------------------------------------

    const handleWasmUpload = async () => {
        if (await uploadParts("browser")) return;
        setUploading(true);
        setProcessing(true);
        const key = "encoding-" + tafFilename + ".taf";

        try {
            if (!isWasmEncoderAvailable()) {
                addLoadingNotification(
                    key,
                    t("tonies.encoder.loading"),
                    t("tonies.encoder.loadingWasmEncoder"),
                );
                await loadWasmEncoder();
                setWasmLoaded(true);
            }

            const currentUnixTime = Math.floor(Date.now() / 1000);
            const audioId = currentUnixTime - 0x50000000;

            addLoadingNotification(
                key,
                t("tonies.encoder.processing"),
                t("tonies.encoder.browserEncodingInProgress"),
            );

            const tafBlob = await WasmTafEncoder.encodeMultipleFiles(
                fileList,
                audioId,
                bitrate,
                (current, total, currentFile) => {
                    addLoadingNotification(
                        key,
                        t("tonies.encoder.processing"),
                        `${t("tonies.encoder.encoding")} ${current + 1}/${total}: ${currentFile}`,
                    );
                },
            );

            setProcessing(false);
            setUploading(true);

            addLoadingNotification(
                key,
                t("tonies.encoder.uploading"),
                t("tonies.encoder.uploadingDetails", { file: tafFilename + ".taf" }),
            );

            const queryParams = {
                name: tafFilename + ".taf",
                path: getPathFromNodeId(treeNodeId),
                special: "library",
            };
            const queryString = createQueryString(queryParams);
            const formData = new FormData();
            formData.append("file", tafBlob, tafFilename + ".taf");

            const response = await api.apiPostTeddyCloudFormDataRaw(
                `/api/tafUpload?${queryString}`,
                formData,
            );
            if (response.ok) {
                // before a split moves the TAF into its folder
                await saveCover(queryParams.path, fileList);
                await finishUpload(key, tafFilename + ".taf", fileTitles(fileList));
                setFileList([]);
                setTafFilename("");
            } else {
                closeLoadingNotification(key);
                addNotification(
                    NotificationTypeEnum.Error,
                    t("tonies.encoder.uploadFailed"),
                    t("tonies.encoder.uploadFailedDetails") + response.statusText,
                    t("tonies.title"),
                );
            }
        } catch (err) {
            closeLoadingNotification(key);
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.encoder.uploadFailed"),
                t("tonies.encoder.uploadFailedDetails") + err,
                t("tonies.title"),
            );
        } finally {
            setProcessing(false);
            setUploading(false);
        }
    };

    return {
        // State
        fileList,
        uploading,
        processing,
        tafFilename,
        hasInvalidChars,
        splitIntoPlaylist,
        useFrontendEncoding,
        useFrontendEncodingSetting,
        coverEnabled,
        coverInfo,
        isCreateDirectoryModalOpen,
        createDirectoryPath,
        inputRef,

        // Actions
        setSplitIntoPlaylist,
        setUseFrontendEncoding,
        setCoverEnabled,
        setCoverInfo,
        sortFileListAlphabeticallyLiteral,
        sortFileListAlphabeticallyNatural,
        clearFileList,
        openCreateDirectoryModal,
        closeCreateDirectoryModal,
        setCreateDirectoryPath,
        handleFileNameInputChange,
        handleUpload,
        handleWasmUpload,

        // DnD / Upload
        sensor,
        onDragEnd,
        uploadProps,
        onRemoveUpload,

        directoryTree,

        // CreateDirectoryModal
        setRebuildList,
        setTreeData,

        // Helper
        invalidCharactersAsString,
    };
};
