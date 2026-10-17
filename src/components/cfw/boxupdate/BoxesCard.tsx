import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, SendOutlined, WarningOutlined } from "@ant-design/icons";

import { cfwApi, CfwBox, CfwChannel, CfwImage, formatBuild } from "../../../api/cfwApi";
import {
    CHANNEL_NUMBER,
    CHANNELS,
    channelKey,
    esp32Installs,
    imageLabel,
    imagesForBox,
    pageOffered,
    platformOf,
} from "./channels";
import { useNotify } from "./useNotify";

const { Text } = Typography;

interface BoxesCardProps {
    boxes: CfwBox[];
    images: CfwImage[];
    loading: boolean;
    onChanged: () => Promise<void>;
}

/** per box: the firmware it runs, its update channel and delivery, and the image assigned to it */
export const BoxesCard: React.FC<BoxesCardProps> = ({ boxes, images, loading, onChanged }) => {
    const { t } = useTranslation();
    const notify = useNotify();

    const setBoxSetting = async (box: CfwBox, name: string, value: number) => {
        const result = await cfwApi.setSetting(name, value, box.id);
        if (!result.ok) notify(result, "", t("cfw.saveError"));
        await onChanged();
    };

    const checkNow = async (box: CfwBox) => {
        notify(
            await cfwApi.checkNow(box.id),
            t("cfw.update.checking"),
            t("cfw.update.checkFailed"),
        );
        await onChanged();
    };

    const deliver = async (box: CfwBox, build: number) => {
        const result = await cfwApi.deliver(box.id, build, false);
        notify(
            result,
            build ? t("cfw.update.assigned") : t("cfw.update.unassigned"),
            t("cfw.saveError"),
        );
        await onChanged();
    };

    const columns: ColumnsType<CfwBox> = [
        {
            title: t("cfw.update.box"),
            key: "box",
            render: (_, box) => (
                <>
                    <div>{box.boxName || box.commonName}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {box.commonName}
                    </Text>{" "}
                    <Tag>{t(`cfw.update.platformName.${platformOf(box)}`)}</Tag>
                </>
            ),
        },
        {
            title: t("cfw.update.running"),
            key: "running",
            render: (_, box) => {
                if (!box.isCfw)
                    return (
                        <>
                            <Text type="secondary">
                                {t("cfw.update.notCfw")}
                                {box.version ? ` · ${formatBuild(box.version)}` : ""}
                            </Text>
                            {!!box.esp32Delivered && (
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {t("cfw.update.esp32Delivered", {
                                            build: formatBuild(box.esp32Delivered),
                                        })}
                                    </Text>
                                </div>
                            )}
                            {box.rolledBackBuild !== 0 && (
                                <div>
                                    <Text type="warning" style={{ fontSize: 12 }}>
                                        <WarningOutlined />{" "}
                                        {t("cfw.update.rolledBack", {
                                            build: formatBuild(box.rolledBackBuild),
                                        })}
                                    </Text>
                                </div>
                            )}
                        </>
                    );
                // version and revision are known when the running build is in the library
                const running = images.find((image) => image.build === box.version);
                return (
                    <>
                        {running && (
                            <div>
                                {running.version || "-"}{" "}
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {running.revision}
                                </Text>
                            </div>
                        )}
                        <div>
                            {formatBuild(box.version)}{" "}
                            <Tag color={box.helloValid ? "green" : undefined}>
                                {t(box.helloValid ? "cfw.box.connected" : "cfw.box.notConnected")}
                            </Tag>
                        </div>
                        {box.rolledBackBuild !== 0 && (
                            <Text type="warning" style={{ fontSize: 12 }}>
                                <WarningOutlined />{" "}
                                {t("cfw.update.rolledBack", {
                                    build: formatBuild(box.rolledBackBuild),
                                })}
                            </Text>
                        )}
                        {box.updateResult === 1 && (
                            <Text type="success" style={{ fontSize: 12 }}>
                                {t("cfw.update.confirmed")}
                            </Text>
                        )}
                        {pageOffered(box, running) && (
                            <div>
                                <Tooltip title={t("cfw.update.pageOfferedHint")}>
                                    <Tag color="blue">
                                        {t("cfw.update.pageOffered", {
                                            version: running?.pageLabel ?? "",
                                        })}
                                    </Tag>
                                </Tooltip>
                            </div>
                        )}
                    </>
                );
            },
        },
        {
            title: t("cfw.update.mode"),
            key: "mode",
            render: (_, box) => (
                <Select
                    style={{ width: 140 }}
                    value={box.update.mode}
                    onChange={(mode) =>
                        setBoxSetting(box, "cfw.update.mode", mode === "automatic" ? 1 : 0)
                    }
                    options={[
                        { value: "manual", label: t("cfw.update.manual") },
                        { value: "automatic", label: t("cfw.update.automatic") },
                    ]}
                />
            ),
        },
        {
            title: t("cfw.update.channelLabel"),
            key: "channel",
            render: (_, box) => (
                <Select
                    style={{ width: 120 }}
                    // only automatic delivery looks at the channel
                    disabled={box.update.mode !== "automatic"}
                    value={box.update.channel}
                    onChange={(channel: CfwChannel) =>
                        setBoxSetting(box, "cfw.update.channel", CHANNEL_NUMBER[channel])
                    }
                    options={(["none", ...CHANNELS] as CfwChannel[]).map((channel) => ({
                        value: channel,
                        label: t(`cfw.channel.${channel}`),
                    }))}
                />
            ),
        },
        {
            title: t("cfw.update.assignedImage"),
            key: "target",
            render: (_, box) => (
                <Select
                    style={{ width: 280 }}
                    value={box.update.target || 0}
                    onChange={(build: number) => deliver(box, build)}
                    options={[
                        { value: 0, label: t("cfw.update.noAssignment") },
                        ...imagesForBox(images, box).map((image) => ({
                            value: image.build,
                            label: imageLabel(image, t(channelKey(image))),
                            disabled: image.build === box.version,
                        })),
                    ]}
                />
            ),
        },
        {
            title: t("cfw.update.next"),
            key: "next",
            render: (_, box) => {
                if (!box.update.enabled || !box.settings.enabled) {
                    return <Text type="secondary">{t("cfw.update.disabled")}</Text>;
                }
                if (esp32Installs(box)) {
                    return (
                        <Tooltip title={t("cfw.update.esp32InstallHint")}>
                            <Tag color="gold">{t("cfw.update.esp32Install")}</Tag>
                        </Tooltip>
                    );
                }
                if (!box.update.next) {
                    return <Text type="secondary">{t("cfw.update.nothing")}</Text>;
                }
                const offered = images.find((image) => image.build === box.update.next);
                if (offered?.original) {
                    return (
                        <Tooltip title={t("cfw.update.esp32ReturnHint")}>
                            <Tag color="orange">
                                {t("cfw.update.esp32Return", { version: offered.version })}
                            </Tag>
                        </Tooltip>
                    );
                }
                return (
                    <Space>
                        <Tooltip title={t("cfw.update.nextHint")}>
                            <Tag color="gold">
                                {offered?.version ? `${offered.version} · ` : ""}
                                {formatBuild(box.update.next)}
                            </Tag>
                        </Tooltip>
                        {pageOffered(box, offered) && (
                            <Tooltip title={t("cfw.update.pageWithNextHint")}>
                                <Tag color="blue">
                                    {t("cfw.update.pageWithNext", {
                                        version: offered?.pageLabel ?? "",
                                    })}
                                </Tag>
                            </Tooltip>
                        )}
                        <Tooltip title={t("cfw.update.deliverNowHint")}>
                            <Button
                                icon={<SendOutlined />}
                                disabled={!box.helloValid}
                                onClick={() => checkNow(box)}
                            >
                                {t("cfw.update.deliverNow")}
                            </Button>
                        </Tooltip>
                    </Space>
                );
            },
        },
    ];

    return (
        <Card
            title={t("cfw.update.boxes")}
            style={{ marginBottom: 16 }}
            extra={<Button icon={<ReloadOutlined />} onClick={onChanged} />}
        >
            <Table
                rowKey="id"
                size="small"
                loading={loading}
                columns={columns}
                dataSource={boxes}
                pagination={false}
                scroll={{ x: true }}
                locale={{ emptyText: t("cfw.update.noBoxes") }}
            />
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                {t("cfw.update.boxesHint")}
            </Text>
        </Card>
    );
};
