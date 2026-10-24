import React, { useCallback, useRef, useState } from "react";
import { FolderAddOutlined, InboxOutlined } from "@ant-design/icons";
import { Button, Upload } from "antd";
import type { UploadProps } from "antd";
import { useTranslation } from "react-i18next";

import { TeddyCloudApi } from "../../../../../api";
import { defaultAPIConfig } from "../../../../../config/defaultApiConfig";
import { IMAGE_EXTENSIONS } from "../../../../../constants/fileTypes";
import { useTeddyCloud } from "../../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../../types/teddyCloudNotificationTypes";
import ConfirmationDialog from "../../../../common/modals/ConfirmationModal";
import { SelectFileFileBrowser } from "../../../filebrowser/SelectFileFileBrowser";
import CreateDirectoryModal from "../CreateDirectoryModal";
import { toCustomImgWebPath } from "../../utils/imagePathUtils";

const api = new TeddyCloudApi(defaultAPIConfig());

type UploadDraggerHandle = React.ComponentRef<typeof Upload.Dragger>;

function clickUploadFileInput(draggerRef: React.RefObject<UploadDraggerHandle | null>) {
    const root =
        draggerRef.current && "upload" in draggerRef.current
            ? (draggerRef.current as { upload?: unknown }).upload
            : undefined;
    const ajax =
        root && typeof root === "object" && root !== null && "uploader" in root
            ? (root as { uploader?: { fileInput?: HTMLInputElement | null } }).uploader
            : undefined;
    ajax?.fileInput?.click();
}

interface CustomImagesPanelProps {
    allowMultiple: boolean;
    customPath: string;
    rebuildTrigger: number;
    active: boolean;
    tableScrollY?: number;
    uploadDraggerProps: UploadProps;
    isCreateDirectoryModalOpen: boolean;
    createDirectoryPath: string;
    createDirectoryInputKey: number;
    hasNewDirectoryInvalidChars: boolean;
    isCreateDirectoryButtonDisabled: boolean;
    inputCreateDirectoryRef: React.RefObject<any>;
    handleCreateDirectoryInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    closeCreateDirectoryModal: () => void;
    createDirectory: () => void;
    openCreateDirectoryModal: (path: string) => void;
    onCustomSelect: (paths: string[], path: string) => void;
    onCustomDoubleClick: (path: string, fileName: string) => void;
    onImagePreview: (imageUrl: string) => void;
    onCustomImgDropFiles: (files: FileList) => void;
    canUpload: boolean;
    canCreateDirectory: boolean;
    /** name: the picture's path in custom_img, e.g. "pic.png" */
    mayDeleteImage: (name: string) => boolean;
    onImageDeleted: (webPath: string) => void;
}

type PictureToDelete = { name: string; webPath: string; figures: number };

export const CustomImagesPanel: React.FC<CustomImagesPanelProps> = ({
    allowMultiple,
    customPath,
    rebuildTrigger,
    active,
    tableScrollY,
    uploadDraggerProps,
    isCreateDirectoryModalOpen,
    createDirectoryPath,
    createDirectoryInputKey,
    hasNewDirectoryInvalidChars,
    isCreateDirectoryButtonDisabled,
    inputCreateDirectoryRef,
    handleCreateDirectoryInputChange,
    closeCreateDirectoryModal,
    createDirectory,
    openCreateDirectoryModal,
    onCustomSelect,
    onCustomDoubleClick,
    onImagePreview,
    onCustomImgDropFiles,
    canUpload,
    canCreateDirectory,
    mayDeleteImage,
    onImageDeleted,
}) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const uploadDraggerRef = useRef<UploadDraggerHandle | null>(null);
    const openUploadDialog = useCallback(() => clickUploadFileInput(uploadDraggerRef), []);
    const [toDelete, setToDelete] = useState<PictureToDelete | null>(null);

    const imageName = (path: string, fileName: string) => `${path}/${fileName}`.replace(/^\/+/, "");

    const askDelete = async (fileName: string, path: string) => {
        const webPath = toCustomImgWebPath(path, fileName);
        let figures = 0;
        try {
            const models = await (await api.apiGetTeddyCloudApiRaw("/api/toniesCustomJson")).json();
            figures = Array.isArray(models) ? models.filter((m) => m?.pic === webPath).length : 0;
        } catch {
            /* the count is only a hint */
        }
        setToDelete({ name: imageName(path, fileName), webPath, figures });
    };

    const deletePicture = async () => {
        if (!toDelete) return;
        const picture = toDelete;
        setToDelete(null);
        const response = await api.apiPostTeddyCloudRaw(
            "/api/fileDelete?special=custom_img",
            picture.name,
        );
        if (response.ok) {
            onImageDeleted(picture.webPath);
        } else {
            addNotification(
                NotificationTypeEnum.Error,
                t("fileBrowser.messages.deleteFailed"),
                `${t("fileBrowser.messages.deleteFailedDetails", { file: picture.name })}: ${await response.text()}`,
                t("fileBrowser.title"),
            );
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", minHeight: 0 }}>
            {isCreateDirectoryModalOpen && (
                <CreateDirectoryModal
                    open={isCreateDirectoryModalOpen}
                    createDirectoryPath={createDirectoryPath}
                    createDirectoryInputKey={createDirectoryInputKey}
                    hasNewDirectoryInvalidChars={hasNewDirectoryInvalidChars}
                    isCreateDirectoryButtonDisabled={isCreateDirectoryButtonDisabled}
                    inputRef={inputCreateDirectoryRef}
                    onInputChange={handleCreateDirectoryInputChange}
                    onClose={closeCreateDirectoryModal}
                    onCreate={createDirectory}
                />
            )}
            <ConfirmationDialog
                title={t("fileBrowser.confirmDeleteModal")}
                open={!!toDelete}
                okText={t("fileBrowser.delete")}
                cancelText={t("fileBrowser.cancel")}
                content={t("fileBrowser.confirmDeleteDialog", { fileToDelete: toDelete?.name })}
                contentDetails={
                    toDelete?.figures
                        ? t("tonies.imageManager.deleteShownBy", { count: toDelete.figures })
                        : undefined
                }
                handleOk={() => void deletePicture()}
                handleCancel={() => setToDelete(null)}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
                <SelectFileFileBrowser
                    key={`custom-picker-${rebuildTrigger}`}
                    special="custom_img"
                    initialPath={customPath}
                    filetypeFilter={IMAGE_EXTENSIONS}
                    trackUrl={false}
                    active={active}
                    tableScrollY={tableScrollY}
                    maxSelectedRows={allowMultiple ? 0 : 1}
                    onImagePreview={onImagePreview}
                    customImgTableDropZone={
                        canUpload
                            ? {
                                  uploadDraggerProps,
                                  uploadDraggerRef,
                                  onDropFiles: onCustomImgDropFiles,
                              }
                            : undefined
                    }
                    onDeleteFile={(fileName, path) => void askDelete(fileName, path)}
                    canDeleteFile={(record, path) =>
                        !record.isDir && mayDeleteImage(imageName(path, record.name))
                    }
                    pathActions={
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {canUpload && (
                                <Button
                                    size="small"
                                    icon={<InboxOutlined />}
                                    title={t("fileBrowser.upload.uploadHint")}
                                    onClick={openUploadDialog}
                                >
                                    {t("fileBrowser.upload.upload")}
                                </Button>
                            )}
                            {canCreateDirectory && (
                                <Button
                                    icon={<FolderAddOutlined />}
                                    size="small"
                                    onClick={() => openCreateDirectoryModal(customPath)}
                                >
                                    {t("fileBrowser.createDirectory.createDirectory")}
                                </Button>
                            )}
                        </div>
                    }
                    showColumns={["picture", "name", "size", "date", "controls"]}
                    onFileSelectChange={(files, path) => {
                        const paths = files
                            .filter((f) => !f.isDir)
                            .map((f) => toCustomImgWebPath(path, f.name));
                        onCustomSelect(paths, path);
                    }}
                    onFileDoubleClick={(file, path) => {
                        if (allowMultiple || file?.isDir) return;
                        onCustomDoubleClick(path, file.name);
                    }}
                />
            </div>
        </div>
    );
};

export default CustomImagesPanel;
