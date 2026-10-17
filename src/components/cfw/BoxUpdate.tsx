import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Typography } from "antd";

import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { cfwApi, CfwFirmwareResponse } from "../../api/cfwApi";
import { useTeddyCloud } from "../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../types/teddyCloudNotificationTypes";
import { BoxesCard } from "./boxupdate/BoxesCard";
import { GithubCard } from "./boxupdate/GithubCard";
import { LibraryCard } from "./boxupdate/LibraryCard";
import LoadingSpinner from "../common/elements/LoadingSpinner";
import { useCfwBoxes } from "./useCfwBoxes";
import { useCfwEnabled } from "./useCfwEnabled";

const api = new TeddyCloudApi(defaultAPIConfig());
const { Paragraph } = Typography;

/** firmware images of the custom firmware and their delivery to the boxes, while CFW support is on */
export const BoxUpdate: React.FC = () => {
    const { t } = useTranslation();
    const enabled = useCfwEnabled();

    if (enabled === undefined) return <LoadingSpinner />;
    if (!enabled) return <Alert type="info" showIcon title={t("cfw.update.supportOff")} />;
    return <BoxUpdateCards />;
};

const BoxUpdateCards: React.FC = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
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
            const [loadedFirmware, intervalResponse] = await Promise.all([
                cfwApi.firmware(),
                api.apiGetTeddyCloudSettingRaw("cfw.firmware.github_interval"),
            ]);
            setFirmware(loadedFirmware);
            setGithubInterval(Number(await intervalResponse.text()) || 24);
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

    return (
        <>
            <Paragraph>{t("cfw.update.intro")}</Paragraph>
            <BoxesCard
                boxes={boxes}
                images={firmware?.images ?? []}
                loading={loading || boxesLoading}
                onChanged={reload}
            />
            <LibraryCard
                images={firmware?.images ?? []}
                defaultPage={firmware?.defaultPage}
                loading={loading}
                onChanged={reload}
            />
            <GithubCard github={firmware?.github} interval={githubInterval} onChanged={reload} />
        </>
    );
};
