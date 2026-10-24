import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Typography } from "antd";

import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { cfwApi, CfwFirmwareResponse } from "../../api/cfwApi";
import { useAcl } from "../../provider/AclProvider";
import { useTeddyCloud } from "../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../types/teddyCloudNotificationTypes";
import { BoxesCard } from "./boxupdate/BoxesCard";
import { GithubCard } from "./boxupdate/GithubCard";
import { InstallGuide } from "./boxupdate/InstallGuide";
import { LibraryCard } from "./boxupdate/LibraryCard";
import LoadingSpinner from "../common/elements/LoadingSpinner";
import { useCfwBoxes } from "./useCfwBoxes";
import { useCfwEnabled } from "./useCfwEnabled";

const api = new TeddyCloudApi(defaultAPIConfig());
const { Paragraph } = Typography;

/**
 * firmware images of the custom firmware and their delivery to the boxes, while CFW support is on;
 * the guide for a box with the original firmware is always there
 */
export const BoxUpdate: React.FC = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const acl = useAcl();
    const [reloadKey, setReloadKey] = useState(0);
    const enabled = useCfwEnabled(undefined, reloadKey);
    const [switching, setSwitching] = useState(false);

    const enable = async () => {
        setSwitching(true);
        try {
            const response = await api.apiPostTeddyCloudSetting("cfw.enabled", true);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await api.apiTriggerWriteConfigGet();
            addNotification(
                NotificationTypeEnum.Success,
                t("cfw.update.guide.enabled"),
                "",
                t("cfw.update.navigationTitle"),
            );
            setReloadKey((key) => key + 1);
        } catch (error) {
            addNotification(
                NotificationTypeEnum.Error,
                t("settings.errorWhileSavingConfig"),
                String(error),
                t("cfw.update.navigationTitle"),
            );
        }
        setSwitching(false);
    };

    if (enabled === undefined) return <LoadingSpinner />;
    if (!enabled)
        return (
            <>
                <Alert
                    type="info"
                    showIcon
                    title={t("cfw.update.supportOff")}
                    action={
                        acl.admin ? (
                            <Button
                                type="primary"
                                loading={switching}
                                onClick={() => void enable()}
                            >
                                {t("cfw.update.guide.enable")}
                            </Button>
                        ) : undefined
                    }
                    style={{ marginBottom: 16 }}
                />
                {acl.admin ? <InstallGuide open /> : null}
            </>
        );
    return <BoxUpdateCards />;
};

const BoxUpdateCards: React.FC = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const acl = useAcl();
    const {
        boxes,
        loading: boxesLoading,
        error: boxesError,
        reload: reloadBoxes,
    } = useCfwBoxes({ active: true });
    const [firmware, setFirmware] = useState<CfwFirmwareResponse | undefined>();
    const [githubInterval, setGithubInterval] = useState(24);
    const [loading, setLoading] = useState(true);

    const notifyLoadError = (error: string) =>
        addNotification(
            NotificationTypeEnum.Error,
            t("cfw.loadError"),
            error,
            t("cfw.update.navigationTitle"),
        );

    const load = async () => {
        setLoading(true);
        try {
            setFirmware(await cfwApi.firmware());
            /* the GitHub download is the admin's */
            if (acl.admin) {
                const intervalResponse = await api.apiGetTeddyCloudSettingRaw(
                    "cfw.firmware.github_interval",
                );
                setGithubInterval(Number(await intervalResponse.text()) || 24);
            }
        } catch (error) {
            notifyLoadError(String(error));
        }
        setLoading(false);
    };

    const reload = async () => {
        await Promise.all([reloadBoxes(), load()]);
    };

    useEffect(() => {
        void load();
    }, []);

    useEffect(() => {
        if (boxesError) notifyLoadError(boxesError);
    }, [boxesError]);

    /* users update the boxes they have the update right for; the builds are the admin's */
    const mine = boxes.filter((box) => acl.can("box", box.id, "box.update"));
    // the guide is for the first box; once one runs the custom firmware it moves down, closed
    const anyCfw = mine.some((box) => box.isCfw);
    const guideFirst = !anyCfw && !boxesLoading && acl.admin;

    return (
        <>
            <Paragraph>{t("cfw.update.intro")}</Paragraph>
            {guideFirst ? <InstallGuide open /> : null}
            <BoxesCard
                boxes={mine}
                images={firmware?.images ?? []}
                loading={loading || boxesLoading}
                onChanged={reload}
            />
            {acl.admin ? (
                <>
                    <LibraryCard
                        images={firmware?.images ?? []}
                        boxes={boxesLoading || boxesError ? undefined : boxes}
                        defaultPage={firmware?.defaultPage}
                        loading={loading}
                        onChanged={reload}
                    />
                    <GithubCard
                        github={firmware?.github}
                        interval={githubInterval}
                        onChanged={reload}
                    />
                    {anyCfw ? <InstallGuide open={false} /> : null}
                </>
            ) : null}
        </>
    );
};
