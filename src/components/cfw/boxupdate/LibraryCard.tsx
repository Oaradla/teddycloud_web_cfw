import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Button,
    Card,
    Collapse,
    Input,
    InputNumber,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, FileTextOutlined, InboxOutlined } from "@ant-design/icons";

import {
    cfwApi,
    CfwChannel,
    CfwEsp32Patch,
    CfwImage,
    CfwPage,
    formatBuild,
    formatTime,
} from "../../../api/cfwApi";
import { CHANNEL_COLOR, CHANNELS, channelKey, imageLabel, platformOf } from "./channels";
import { useNotify } from "./useNotify";

const { Text, Paragraph } = Typography;

interface LibraryCardProps {
    images: CfwImage[];
    defaultPage?: CfwPage;
    loading: boolean;
    onChanged: () => Promise<void>;
}

/** the firmware images: upload with a channel (the original ESP32 firmware with teddyCloud's patches), change
 * channel and notes, delete */
export const LibraryCard: React.FC<LibraryCardProps> = ({
    images,
    defaultPage,
    loading,
    onChanged,
}) => {
    const { t } = useTranslation();
    const notify = useNotify();
    const [uploadChannel, setUploadChannel] = useState<CfwChannel>("beta");
    const [patch, setPatch] = useState<CfwEsp32Patch>({});

    const edit = async (image: CfwImage, change: { channel?: CfwChannel; notes?: string }) => {
        const result = await cfwApi.editFirmware(image, change);
        if (!result.ok) notify(result, "", t("cfw.saveError"));
        await onChanged();
    };

    const columns: ColumnsType<CfwImage> = [
        {
            title: t("cfw.update.build"),
            key: "build",
            render: (_, image) => (
                <>
                    <div>{formatBuild(image.build)}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {image.build}
                    </Text>
                </>
            ),
        },
        {
            title: t("cfw.update.version"),
            key: "version",
            render: (_, image) => (
                <>
                    <div>
                        {image.version || "-"}{" "}
                        <Tag>{t(`cfw.update.platformName.${platformOf(image)}`)}</Tag>
                        {image.original && <Tag color="orange">{t("cfw.update.original")}</Tag>}
                        {image.pageNew ? (
                            <Tooltip title={t("cfw.update.pageNewHint")}>
                                <Tag color="blue">
                                    {t("cfw.update.pageNew", { version: image.pageLabel ?? "" })}
                                </Tag>
                            </Tooltip>
                        ) : (
                            !!image.page && (
                                <Tag>
                                    {t("cfw.update.pageSame", { version: image.pageLabel ?? "" })}
                                </Tag>
                            )
                        )}
                        {!!image.page && !!image.pageRequires && (
                            <Tooltip title={t("cfw.update.pageRequiresHint")}>
                                <Tag>
                                    {t("cfw.update.pageRequires", { version: image.pageRequires })}
                                </Tag>
                            </Tooltip>
                        )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {image.original
                            ? image.patches
                                ? t("cfw.update.patched", { patches: image.patches })
                                : t("cfw.update.unpatched")
                            : image.revision}
                    </Text>
                </>
            ),
        },
        {
            title: t("cfw.update.channelLabel"),
            key: "channel",
            render: (_, image) =>
                image.original ? (
                    <Text type="secondary">{t("cfw.update.originalChannel")}</Text>
                ) : (
                    <Select
                        style={{ width: 120 }}
                        value={image.channel}
                        onChange={(channel: CfwChannel) => edit(image, { channel })}
                        options={CHANNELS.map((channel) => ({
                            value: channel,
                            label: (
                                <Tag color={CHANNEL_COLOR[channel]}>
                                    {t(`cfw.channel.${channel}`)}
                                </Tag>
                            ),
                        }))}
                    />
                ),
        },
        {
            title: t("cfw.update.source"),
            key: "source",
            render: (_, image) =>
                image.source === "github"
                    ? `GitHub ${image.githubTag}`
                    : t("cfw.update.sourceUpload"),
        },
        {
            title: t("cfw.update.notes"),
            key: "notes",
            render: (_, image) => (
                <Paragraph
                    style={{ margin: 0, minWidth: 160 }}
                    editable={{
                        onChange: (notes) => notes !== image.notes && edit(image, { notes }),
                    }}
                >
                    {image.notes}
                </Paragraph>
            ),
        },
        {
            title: t("cfw.update.added"),
            key: "added",
            render: (_, image) => formatTime(image.added),
        },
        {
            key: "actions",
            render: (_, image) => (
                <Space>
                    {!image.original && (
                        <Upload
                            accept=".htm,.html"
                            showUploadList={false}
                            customRequest={async ({ file, onSuccess, onError }) => {
                                const result = await cfwApi.uploadPage(file as File, image);
                                notify(
                                    result.page
                                        ? { ...result, message: result.page.label }
                                        : result,
                                    t("cfw.update.pageUploaded"),
                                    t("cfw.update.uploadFailed"),
                                );
                                if (result.ok) onSuccess?.(result);
                                else onError?.(new Error(result.message));
                                await onChanged();
                            }}
                        >
                            <Tooltip title={t("cfw.update.pageUploadHint")}>
                                <Button icon={<FileTextOutlined />} />
                            </Tooltip>
                        </Upload>
                    )}
                    <Popconfirm
                        title={t("cfw.update.deleteConfirm", { build: formatBuild(image.build) })}
                        onConfirm={async () => {
                            notify(
                                await cfwApi.deleteFirmware(image),
                                t("cfw.update.deleted"),
                                t("cfw.saveError"),
                            );
                            await onChanged();
                        }}
                    >
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title={t("cfw.update.library")} style={{ marginBottom: 16 }}>
            <Space align="center" style={{ marginBottom: 8 }} wrap>
                <Text>{t("cfw.update.uploadChannel")}</Text>
                <Select
                    style={{ width: 120 }}
                    value={uploadChannel}
                    onChange={setUploadChannel}
                    options={CHANNELS.map((channel) => ({
                        value: channel,
                        label: t(`cfw.channel.${channel}`),
                    }))}
                />
            </Space>
            <Collapse
                size="small"
                style={{ marginBottom: 8 }}
                items={[
                    {
                        key: "patch",
                        label: t("cfw.update.patchTitle"),
                        children: (
                            <Space orientation="vertical" style={{ width: "100%" }}>
                                <Text type="secondary">{t("cfw.update.patchHint")}</Text>
                                <Space wrap>
                                    <Input
                                        style={{ width: 220 }}
                                        maxLength={64}
                                        placeholder={t("cfw.update.patchHost")}
                                        value={patch.hostname}
                                        onChange={(e) =>
                                            setPatch({ ...patch, hostname: e.target.value.trim() })
                                        }
                                    />
                                    <Input
                                        style={{ width: 220 }}
                                        maxLength={64}
                                        placeholder={t("cfw.update.patchHostOld")}
                                        value={patch.hostnameOld}
                                        disabled={!patch.hostname}
                                        onChange={(e) =>
                                            setPatch({
                                                ...patch,
                                                hostnameOld: e.target.value.trim(),
                                            })
                                        }
                                    />
                                    <InputNumber
                                        style={{ width: 140 }}
                                        min={1}
                                        max={32767}
                                        placeholder={t("cfw.update.patchPort")}
                                        value={patch.port}
                                        onChange={(port) =>
                                            setPatch({ ...patch, port: port ?? undefined })
                                        }
                                    />
                                </Space>
                            </Space>
                        ),
                    },
                ]}
            />
            <Upload.Dragger
                accept=".zip,.bin,.img,.htm,.html"
                multiple={false}
                showUploadList={false}
                customRequest={async ({ file, onSuccess, onError }) => {
                    if (/\.html?$/i.test((file as File).name)) {
                        // a setup page alone: the default page for images without one
                        const page = await cfwApi.uploadPage(file as File);
                        notify(
                            page.page ? { ...page, message: page.page.label } : page,
                            t("cfw.update.pageUploaded"),
                            t("cfw.update.uploadFailed"),
                        );
                        if (page.ok) onSuccess?.(page);
                        else onError?.(new Error(page.message));
                        await onChanged();
                        return;
                    }
                    const result = await cfwApi.uploadFirmware(file as File, uploadChannel, patch);
                    // a release package brings several images
                    const added = result.images?.length
                        ? result.images
                        : result.image
                          ? [result.image]
                          : [];
                    notify(
                        added.length
                            ? {
                                  ...result,
                                  message: added
                                      .map((image) => imageLabel(image, t(channelKey(image))))
                                      .join(", "),
                              }
                            : result,
                        t("cfw.update.uploaded"),
                        t("cfw.update.uploadFailed"),
                    );
                    if (result.ok) {
                        onSuccess?.(result);
                    } else {
                        onError?.(new Error(result.message));
                    }
                    await onChanged();
                }}
                style={{ marginBottom: 16 }}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">{t("cfw.update.uploadText")}</p>
                <p className="ant-upload-hint">{t("cfw.update.uploadHint")}</p>
            </Upload.Dragger>
            <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                {defaultPage?.page
                    ? t("cfw.update.defaultPage", {
                          version: defaultPage.requires
                              ? `${defaultPage.label} (${t("cfw.update.pageRequires", { version: defaultPage.requires })})`
                              : defaultPage.label,
                      })
                    : t("cfw.update.noDefaultPage")}
            </Text>
            <Table
                rowKey={(image) => `${platformOf(image)}-${image.build}`}
                size="small"
                loading={loading}
                columns={columns}
                dataSource={images}
                pagination={false}
                scroll={{ x: true }}
                locale={{ emptyText: t("cfw.update.noImages") }}
            />
        </Card>
    );
};
