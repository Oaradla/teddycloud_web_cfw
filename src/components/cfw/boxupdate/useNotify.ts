import { useTranslation } from "react-i18next";
import { CfwResult } from "../../../api/cfwApi";
import { useTeddyCloud } from "../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../types/teddyCloudNotificationTypes";
import { cfwMessage } from "../cfwMessages";

/** a notification for the result of an action on the Box update page */
export const useNotify = () => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    return (result: CfwResult, success: string, failure: string) =>
        addNotification(
            result.ok ? NotificationTypeEnum.Success : NotificationTypeEnum.Error,
            result.ok ? success : failure,
            cfwMessage(t, result.message),
            t("cfw.update.navigationTitle"),
        );
};
