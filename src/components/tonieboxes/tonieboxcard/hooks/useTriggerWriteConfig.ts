import { useTranslation } from "react-i18next";

import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { writeConfig } from "../../../../utils/settings/writeConfig";

export const useTriggerWriteConfig = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();

    const triggerWriteConfig = async () => {
        try {
            await writeConfig();
        } catch (error) {
            addNotification(
                NotificationTypeEnum.Error,
                t("settings.errorWhileSavingConfig"),
                t("settings.errorWhileSavingConfigDetails") + error,
                t("tonieboxes.navigationTitle"),
            );
        }
    };

    return triggerWriteConfig;
};
