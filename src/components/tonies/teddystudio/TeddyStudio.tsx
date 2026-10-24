import React, { useState } from "react";
import { Alert, Button, Collapse, Divider, Typography } from "antd";
import {
    ClearOutlined,
    DownloadOutlined,
    FolderAddOutlined,
    LoadingOutlined,
    PrinterOutlined,
    ScissorOutlined,
    UnorderedListOutlined,
    UserAddOutlined,
} from "@ant-design/icons";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";

import { useTeddyCloud } from "../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../types/teddyCloudNotificationTypes";

import { useData } from "./hooks/useData";
import { useCustomItems } from "./hooks/useCustomItems";
import { useSettings } from "./hooks/useSettings";
import { SettingsPanel } from "./settingspanel/SettingsPanel";
import { LabelGrid } from "./grid/LabelGrid";
import { ToniesJsonSearchWrapper } from "./input/ToniesJsonSearchWrapper";
import { BulkAddToniesModal } from "./input/BulkAddToniesModal";
import { CustomImages } from "./input/CustomImages";
import { EditLabelModal } from "./modals/EditLabelModal";
import { LabelOverridesById, LabelOverrides } from "./types/labelOverrides";
import { createTeddyStudioPdf } from "./print/teddyStudioPdf";
import { createTeddyStudioPdfFilename, downloadPdfBlob, printPdfBlob } from "./print/printFile";
import SelectImageModal from "../common/modals/SelectImageModal";
import { AddFolderModal } from "./input/AddFolderModal";
import { folderTonieInfos, freshDatasets, myTonieInfos } from "./input/addFromTeddyCloud";
import { cutFiles } from "./utils/cutSvg";

/** offers a file for download */
const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

const { Paragraph } = Typography;

export const TeddyStudio: React.FC = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();

    const { handleSearch } = useData();
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [preparingPdfAction, setPreparingPdfAction] = useState<"print" | "download" | null>(null);

    const {
        customItems,
        mergedResults,
        addResult,
        addResults,
        addCustomImage,
        addCustomImageByPath,
        removeByMergedIndex,
        editByMergedIndex,
        clearAll,
    } = useCustomItems();
    const [imageManagerOpen, setImageManagerOpen] = useState(false);
    const [bulkAddOpen, setBulkAddOpen] = useState(false);
    const [addFolderOpen, setAddFolderOpen] = useState(false);
    const [addingMine, setAddingMine] = useState(false);

    const settingsStore = useSettings();

    const { state: settings, paperOptions, actions } = settingsStore;

    const [labelOverridesById, setLabelOverridesById] = useState<LabelOverridesById>({});

    const setLabelOverride = (id: string, patch: LabelOverrides) => {
        setLabelOverridesById((prev) => ({
            ...prev,
            [id]: { ...(prev[id] ?? {}), ...patch },
        }));
    };

    const clearLabelOverride = (id: string) => {
        setLabelOverridesById((prev) => {
            const { [id]: _removed, ...rest } = prev;
            return rest;
        });
    };

    const canGoPrev = editIndex !== null && editIndex > 0;
    const canGoNext = editIndex !== null && editIndex < mergedResults.length - 1;

    const handlePrevLabel = () => {
        if (editIndex === null || editIndex <= 0) return;
        setEditIndex(editIndex - 1);
    };

    const handleNextLabel = () => {
        if (editIndex === null || editIndex >= mergedResults.length - 1) return;
        setEditIndex(editIndex + 1);
    };

    const handleSuggestionClick = (dataset: any) => {
        addResult(dataset);
        handleSearch("");
    };

    const handleSaveSettings = () => {
        actions.save();
        addNotification(
            NotificationTypeEnum.Success,
            t("tonies.teddystudio.settingsSavedSuccessful"),
            t("tonies.teddystudio.settingsSavedSuccessful"),
            t("tonies.teddystudio.navigationTitle"),
        );
    };

    const handleClearSettings = () => {
        actions.clear();
    };

    const handleRemoveResult = (indexToRemove: number) => {
        removeByMergedIndex(indexToRemove);
    };

    const handleEditResult = (indexToEdit: number) => {
        setEditIndex(indexToEdit);
    };

    const handleCloseModal = () => {
        setEditIndex(null);
    };

    const handleSaveLabelElements = (values: {
        text: string;
        episodes: string;
        trackTitles: string[];
        picture: string;
    }) => {
        if (editIndex === null) return;
        editByMergedIndex(
            editIndex,
            values.trackTitles,
            values.episodes,
            values.text,
            values.picture,
        );

        addNotification(
            NotificationTypeEnum.Success,
            t("tonies.teddystudio.labelSavedSuccesful"),
            t("tonies.teddystudio.labelSavedSuccesfulDetails", { title: values.text }),
            t("tonies.teddystudio.navigationTitle"),
            undefined,
            false,
        );
    };

    const handlePdfAction = async (action: "print" | "download") => {
        if (preparingPdfAction !== null || mergedResults.length === 0) return;

        setPreparingPdfAction(action);

        try {
            const warnings = new Map<string, string>();
            const pdf = await createTeddyStudioPdf({
                items: mergedResults,
                settings,
                labelOverridesById,
                onWarning: (warning) => {
                    const key = `${warning.code}:${warning.url ?? warning.message}`;
                    warnings.set(key, warning.message);
                    console.warn(`[TeddyStudio PDF] ${warning.message}`);
                },
            });

            const filename = createTeddyStudioPdfFilename();

            if (action === "download") {
                downloadPdfBlob(pdf, filename);
            } else {
                const printResult = await printPdfBlob(pdf, filename);
                if (printResult === "downloaded") {
                    addNotification(
                        NotificationTypeEnum.Warning,
                        t("tonies.teddystudio.printPage"),
                        "The browser could not print or open the finished PDF. The PDF was downloaded instead.",
                        t("tonies.teddystudio.navigationTitle"),
                        undefined,
                        false,
                    );
                }
            }

            if (warnings.size > 0) {
                const descriptions = Array.from(warnings.values());
                const description =
                    descriptions.length === 1
                        ? descriptions[0]
                        : `${descriptions.length} resources could not be loaded while creating the PDF. The affected content was skipped.`;
                addNotification(
                    NotificationTypeEnum.Warning,
                    action === "print"
                        ? t("tonies.teddystudio.printPage")
                        : t("tonies.teddystudio.downloadPdf"),
                    description,
                    t("tonies.teddystudio.navigationTitle"),
                    undefined,
                    false,
                );
            }
        } catch (error) {
            const description = error instanceof Error ? error.message : String(error);
            addNotification(
                NotificationTypeEnum.Error,
                action === "print"
                    ? t("tonies.teddystudio.printPage")
                    : t("tonies.teddystudio.downloadPdf", { defaultValue: "Download PDF" }),
                description,
                t("tonies.teddystudio.navigationTitle"),
                undefined,
                false,
            );
        } finally {
            setPreparingPdfAction(null);
        }
    };

    const handlePrintPage = () => handlePdfAction("print");
    const handleDownloadPdf = () => handlePdfAction("download");

    const currentItem = editIndex !== null ? mergedResults[editIndex] : null;

    const labelSettingsSummary = `${
        settings.labelShape === "round"
            ? `${t("tonies.teddystudio.round")} ${settings.diameter}`
            : `${settings.width} x ${settings.height}`
    }`;

    /** adds the tonies not on the sheet yet and says how many */
    const addInfos = (infos: Parameters<typeof freshDatasets>[0]) => {
        const fresh = freshDatasets(infos, mergedResults);
        addResults(fresh);
        addNotification(
            fresh.length ? NotificationTypeEnum.Success : NotificationTypeEnum.Info,
            t("tonies.teddystudio.added", { count: fresh.length }),
            t("tonies.teddystudio.added", { count: fresh.length }),
            t("tonies.teddystudio.navigationTitle"),
        );
    };

    const addFailed = (error: unknown) =>
        addNotification(
            NotificationTypeEnum.Error,
            t("tonies.teddystudio.addFailed"),
            String(error),
            t("tonies.teddystudio.navigationTitle"),
        );

    const handleAddMine = async () => {
        setAddingMine(true);
        try {
            addInfos(await myTonieInfos());
        } catch (error) {
            addFailed(error);
        } finally {
            setAddingMine(false);
        }
    };

    const handleAddFolder = async (path: string) => {
        try {
            addInfos(await folderTonieInfos(path));
        } catch (error) {
            addFailed(error);
        }
    };

    /** the cut lines of the sheets for a laser cutter: one SVG, or a zip with full sheet and rest */
    const handleCutLines = async () => {
        let files: Record<string, string>;
        try {
            files = cutFiles(settings, mergedResults.length);
        } catch (error) {
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.teddystudio.cutLines"),
                error instanceof Error ? error.message : String(error),
                t("tonies.teddystudio.navigationTitle"),
            );
            return;
        }
        const names = Object.keys(files);
        if (names.length === 1) {
            download(new Blob([files[names[0]]], { type: "image/svg+xml" }), names[0]);
            return;
        }
        const zip = new JSZip();
        for (const name of names) zip.file(name, files[name]);
        const blob = await zip.generateAsync({ type: "blob" });
        download(blob, names[0].replace(/-full-.*$/, ".zip"));
    };

    const printModeSummary = t(
        `tonies.teddystudio.printMode${settings.printMode.charAt(0).toUpperCase() + settings.printMode.slice(1)}`,
    );

    const paperSizeSummary =
        settings.paperSize === "Custom"
            ? `${settings.paperSize} (${settings.customPaperWidth} x ${settings.customPaperHeight})`
            : settings.paperSize;

    return (
        <>
            <h1>{t("tonies.teddystudio.title")}</h1>
            <Paragraph>{t("tonies.teddystudio.intro")}</Paragraph>
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    width: "100%",
                    alignItems: "flex-start",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        minWidth: 300,
                        maxWidth: 600,
                    }}
                >
                    <ToniesJsonSearchWrapper onSelectDataset={addResult} />
                </div>
                <div style={{ marginTop: 8 }}>
                    <Button icon={<UnorderedListOutlined />} onClick={() => setBulkAddOpen(true)}>
                        {t("tonies.teddystudio.bulkAdd.button")}
                    </Button>
                </div>
                <div style={{ marginTop: 8 }}>
                    <Button icon={<UserAddOutlined />} loading={addingMine} onClick={handleAddMine}>
                        {t("tonies.teddystudio.addMine")}
                    </Button>
                </div>
                <div style={{ marginTop: 8 }}>
                    <Button icon={<FolderAddOutlined />} onClick={() => setAddFolderOpen(true)}>
                        {t("tonies.teddystudio.addFolder.button")}
                    </Button>
                </div>
            </div>
            <BulkAddToniesModal
                open={bulkAddOpen}
                onClose={() => setBulkAddOpen(false)}
                onConfirm={(datasets) => addResults(datasets)}
            />
            <AddFolderModal
                open={addFolderOpen}
                onClose={() => setAddFolderOpen(false)}
                onConfirm={handleAddFolder}
            />
            <CustomImages
                customItems={customItems}
                onAddImage={addCustomImage}
                onOpenImageManager={() => setImageManagerOpen(true)}
            />
            <SelectImageModal
                open={imageManagerOpen}
                onClose={() => setImageManagerOpen(false)}
                onSelectImage={(path) => addCustomImageByPath(path)}
                allowMultiple
            />
            <Collapse
                className="settingsPanel"
                bordered={false}
                items={[
                    {
                        key: "1",
                        label: `${t("tonies.teddystudio.settings")}: ${labelSettingsSummary} | ${t(
                            "tonies.teddystudio.printMode",
                        )}: ${printModeSummary} | ${t("tonies.teddystudio.paperSize")}: ${paperSizeSummary}`,
                        children: [
                            <SettingsPanel
                                key="settingsPanel"
                                settings={settings}
                                paperOptions={paperOptions}
                                actions={actions}
                                onPaperSelect={actions.applyPaperPreset}
                                onSave={handleSaveSettings}
                                onClear={handleClearSettings}
                            />,
                        ],
                    },
                ]}
            />
            <Divider>{t("tonies.teddystudio.printSheet")}</Divider>
            {mergedResults.length > 0 ? (
                <Paragraph
                    style={{
                        marginBottom: 16,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                    }}
                >
                    <div>{t("tonies.teddystudio.adaptLabelsHint")}</div>
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                        }}
                    >
                        <Button
                            icon={<ClearOutlined />}
                            onClick={() => {
                                clearAll();
                            }}
                        >
                            {t("tonies.teddystudio.clear")}
                        </Button>
                        <Button icon={<ScissorOutlined />} onClick={handleCutLines}>
                            {t("tonies.teddystudio.cutLines")}
                        </Button>
                        <Button
                            icon={
                                preparingPdfAction === "download" ? (
                                    <LoadingOutlined spin />
                                ) : (
                                    <DownloadOutlined />
                                )
                            }
                            disabled={preparingPdfAction !== null}
                            onClick={handleDownloadPdf}
                        >
                            {t("tonies.teddystudio.downloadPdf", { defaultValue: "Download PDF" })}
                        </Button>
                        <Button
                            type="primary"
                            icon={
                                preparingPdfAction === "print" ? (
                                    <LoadingOutlined spin />
                                ) : (
                                    <PrinterOutlined />
                                )
                            }
                            disabled={preparingPdfAction !== null}
                            onClick={handlePrintPage}
                        >
                            {t("tonies.teddystudio.printPage")}
                        </Button>
                    </div>
                </Paragraph>
            ) : (
                <Paragraph style={{ marginBottom: 16 }}>{t("tonies.teddystudio.empty")}</Paragraph>
            )}
            <LabelGrid
                mergedResults={mergedResults}
                settings={settings}
                onRemoveItem={handleRemoveResult}
                onEditItem={handleEditResult}
                labelOverridesById={labelOverridesById}
                onClearLocalOverrides={(id) => clearLabelOverride(id)}
            />
            <EditLabelModal
                open={editIndex !== null}
                item={currentItem}
                onCancel={handleCloseModal}
                onSave={handleSaveLabelElements}
                onPrev={handlePrevLabel}
                onNext={handleNextLabel}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                currentIndex={editIndex ?? undefined}
                totalItems={mergedResults.length}
                settingsStore={settingsStore}
                labelOverridesById={labelOverridesById}
                setLabelOverride={setLabelOverride}
                clearLabelOverride={clearLabelOverride}
            />
        </>
    );
};
