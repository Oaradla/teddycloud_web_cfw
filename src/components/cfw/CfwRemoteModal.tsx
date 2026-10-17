import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Button,
    Descriptions,
    Divider,
    Modal,
    Select,
    Slider,
    Space,
    Tag,
    Tooltip,
    Typography,
} from "antd";
import {
    CaretRightOutlined,
    CloudSyncOutlined,
    PauseOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    StopOutlined,
} from "@ant-design/icons";

import { cfwApi, CfwStatus, formatTime } from "../../api/cfwApi";
import { cfwMessage } from "./cfwMessages";
import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { TonieCardProps } from "../../types/tonieTypes";
import { useTeddyCloud } from "../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../types/teddyCloudNotificationTypes";

const api = new TeddyCloudApi(defaultAPIConfig());
const { Text } = Typography;

interface CfwRemoteModalProps {
    boxId: string;
    boxName: string;
    onClose: () => void;
}

/** remote control of a box with the custom firmware (F12) */
export const CfwRemoteModal: React.FC<CfwRemoteModalProps> = ({ boxId, boxName, onClose }) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const [status, setStatus] = useState<CfwStatus | undefined>();
    const [tonies, setTonies] = useState<TonieCardProps[]>([]);
    const [playRuid, setPlayRuid] = useState<string | undefined>();
    // the slider follows the box (the ears change the volume too) except while it is dragged
    const [draggedVolume, setDraggedVolume] = useState<number | undefined>();
    const refreshTimer = useRef<number | undefined>(undefined);

    const refresh = async () => {
        try {
            setStatus(await cfwApi.status(boxId));
        } catch {
            // the next poll tries again
        }
    };

    const send = async (command: string, extra: Record<string, unknown> = {}) => {
        const result = await cfwApi.remote(boxId, command, extra);
        if (!result.ok) {
            addNotification(
                NotificationTypeEnum.Error,
                t("cfw.remote.commandFailed"),
                cfwMessage(t, result.message),
                boxName,
            );
        }
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(refresh, 1500);
    };

    useEffect(() => {
        refresh();
        // a status request turns on the status reports of the box for this connection
        cfwApi.remote(boxId, "status");
        api.apiGetTagIndex(boxId)
            .then((tags) => setTonies(tags.filter((tag) => tag.type !== "system")))
            .catch(() => setTonies([]));
        const poll = window.setInterval(refresh, 2000);
        return () => {
            window.clearInterval(poll);
            window.clearTimeout(refreshTimer.current);
        };
    }, [boxId]);

    const s = status?.status;
    const tonieName = (ruid?: string) => {
        if (!ruid) return "-";
        const tonie = tonies.find((tag) => tag.ruid.toUpperCase() === ruid.toUpperCase());
        if (!tonie) return ruid;
        return (
            [tonie.tonieInfo?.series, tonie.tonieInfo?.episode].filter(Boolean).join(" - ") || ruid
        );
    };
    const remote = status?.remote === true;
    // only tags whose content the server holds: playing any other ends in an error prompt on the box;
    // equal names (a figure model on several tags) get the rUID to tell them apart
    const playable = tonies.filter((tag) => tag.exists);
    const playOptions = playable.map((tag) => {
        const name = tonieName(tag.ruid);
        const twice = playable.some((other) => other !== tag && tonieName(other.ruid) === name);
        return { value: tag.ruid, label: twice ? `${name} (${tag.ruid.toUpperCase()})` : name };
    });

    return (
        <Modal
            open
            onCancel={onClose}
            footer={null}
            title={t("cfw.remote.title", { name: boxName })}
            width={640}
        >
            {!remote && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title={t("cfw.remote.notAvailable")}
                    description={t("cfw.remote.notAvailableHint")}
                />
            )}
            <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label={t("cfw.remote.state")}>
                    {s ? (
                        <Tag
                            color={
                                s.state === "playing"
                                    ? "green"
                                    : s.state === "paused"
                                      ? "orange"
                                      : undefined
                            }
                        >
                            {t(`cfw.remote.states.${s.state}`)}
                        </Tag>
                    ) : (
                        "-"
                    )}
                    {status?.queued ? (
                        <Text type="secondary">
                            {" "}
                            {t("cfw.remote.queued", { count: status.queued })}
                        </Text>
                    ) : null}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.tonie")}>
                    {tonieName(s?.ruid)}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.chapter")}>
                    {s && s.ruid ? s.chapter + 1 : "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.volume")}>
                    {s
                        ? t("cfw.remote.volumeValue", {
                              step: s.volume,
                              limit: s.limit,
                              output: t(
                                  s.headphones ? "cfw.remote.headphones" : "cfw.remote.speaker",
                              ),
                          })
                        : "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.battery")}>
                    {s
                        ? `${(s.batteryMv / 1000).toFixed(2)} V${s.charging ? " · " + t("cfw.remote.charging") : ""}`
                        : "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.locks")}>
                    {s ? (
                        <Space size={4}>
                            {(["slap", "tilt", "volume"] as const).map((lock) => (
                                <Tag key={lock} color={s.locks[lock] ? "red" : undefined}>
                                    {t(`cfw.${lock}Lock`)}
                                </Tag>
                            ))}
                        </Space>
                    ) : (
                        "-"
                    )}
                </Descriptions.Item>
                <Descriptions.Item label={t("cfw.remote.updated")}>
                    {formatTime(s?.time)}
                </Descriptions.Item>
            </Descriptions>

            <Divider />
            <Space wrap style={{ justifyContent: "center", width: "100%" }}>
                <Tooltip title={t("cfw.remote.prev")}>
                    <Button
                        icon={<StepBackwardOutlined />}
                        disabled={!remote}
                        onClick={() => send("prev")}
                    />
                </Tooltip>
                <Tooltip title={t("cfw.remote.pause")}>
                    <Button
                        icon={<PauseOutlined />}
                        disabled={!remote}
                        onClick={() => send("pause")}
                    />
                </Tooltip>
                <Tooltip title={t("cfw.remote.continue")}>
                    <Button
                        icon={<CaretRightOutlined />}
                        disabled={!remote}
                        onClick={() => send("continue")}
                    />
                </Tooltip>
                <Tooltip title={t("cfw.remote.stop")}>
                    <Button
                        icon={<StopOutlined />}
                        disabled={!remote}
                        onClick={() => send("stop")}
                    />
                </Tooltip>
                <Tooltip title={t("cfw.remote.next")}>
                    <Button
                        icon={<StepForwardOutlined />}
                        disabled={!remote}
                        onClick={() => send("next")}
                    />
                </Tooltip>
                <Tooltip title={t("cfw.remote.refresh")}>
                    <Button
                        icon={<ReloadOutlined />}
                        disabled={!remote}
                        onClick={() => send("status")}
                    />
                </Tooltip>
            </Space>

            <Divider titlePlacement="left">{t("cfw.remote.volume")}</Divider>
            <Slider
                min={0}
                max={15}
                disabled={!remote}
                value={draggedVolume ?? s?.volume}
                onChange={setDraggedVolume}
                onChangeComplete={(value) => {
                    setDraggedVolume(undefined);
                    send("volume", { volume: value });
                }}
                marks={{ 0: "0", 5: "5", 10: "10", 15: "15" }}
            />

            <Divider titlePlacement="left">{t("cfw.remote.playContent")}</Divider>
            <Space.Compact style={{ width: "100%" }}>
                <Select
                    showSearch
                    style={{ width: "100%" }}
                    placeholder={t("cfw.remote.selectTonie")}
                    value={playRuid}
                    onChange={setPlayRuid}
                    optionFilterProp="label"
                    options={playOptions}
                />
                <Button
                    icon={<PlayCircleOutlined />}
                    disabled={!remote || !playRuid}
                    onClick={() => send("play", { ruid: playRuid })}
                >
                    {t("cfw.remote.play")}
                </Button>
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12 }}>
                {t("cfw.remote.playHint")}
            </Text>

            <Divider />
            <Button
                icon={<CloudSyncOutlined />}
                disabled={!remote}
                onClick={() => send("updateCheck")}
            >
                {t("cfw.remote.updateCheck")}
            </Button>
            {status?.lastResult && (
                <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                    {t("cfw.remote.lastResult", {
                        command: t(`cfw.remote.commands.${status.lastResult.command}`, {
                            defaultValue: String(status.lastResult.command),
                        }),
                        result: t(`cfw.remote.results.${status.lastResult.result}`, {
                            defaultValue: String(status.lastResult.result),
                        }),
                        time: formatTime(status.lastResult.time),
                    })}
                </Text>
            )}
        </Modal>
    );
};
