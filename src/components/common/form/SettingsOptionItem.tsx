import { useTranslation } from "react-i18next";
import SettingsDataHandler from "../../../data/SettingsDataHandler";
import { settingKey } from "./settingKey";
import { SettingsInputField } from "./SettingsInputField";
import { SettingsInputNumberField } from "./SettingsInputNumberField";
import { SettingsSwitchField } from "./SettingsSwitchField";
import { SettingsSelectField } from "./SettingsSelectField";

interface SettingsOptionItem {
    iD: string;
    noOverlay?: boolean;
    overlayId?: string;
}

export const SettingsOptionItem: React.FC<SettingsOptionItem> = (props) => {
    const { iD } = props;
    const { t } = useTranslation();
    const option = SettingsDataHandler.getInstance().getSetting(props.iD);

    const overlayedProp = props.noOverlay ? undefined : option?.overlayed;

    if (option !== undefined) {
        const key = settingKey(iD);
        const label = t(`settings.options.${key}.label`, { defaultValue: option.label });
        const description =
            t(`settings.options.${key}.description`, { defaultValue: option.description }) +
            (option.derived ? " " + t("settings.derivedFromCfw") : "");
        const { type } = option;

        return (
            <div key={iD}>
                {type === "bool" && (
                    <SettingsSwitchField
                        name={iD}
                        label={label}
                        description={description}
                        overlayed={overlayedProp}
                        overlayId={props.overlayId}
                    />
                )}
                {type === "int" && (
                    <SettingsInputNumberField
                        name={iD}
                        label={label}
                        description={description}
                        overlayed={overlayedProp}
                        overlayId={props.overlayId}
                    />
                )}
                {type === "uint" && option.values && option.values.length > 0 && (
                    <SettingsSelectField
                        name={iD}
                        label={label}
                        description={description}
                        values={option.values}
                        overlayed={overlayedProp}
                        overlayId={props.overlayId}
                    />
                )}
                {type === "uint" && !(option.values && option.values.length > 0) && (
                    <SettingsInputNumberField
                        name={iD}
                        label={label}
                        description={description}
                        overlayed={overlayedProp}
                        overlayId={props.overlayId}
                    />
                )}
                {type === "string" && (
                    <SettingsInputField
                        name={iD}
                        label={label}
                        description={description}
                        overlayed={props.noOverlay ? undefined : option?.overlayed}
                        overlayId={props.overlayId}
                    />
                )}
            </div>
        );
    } else {
        console.warn("No option found for iD ", iD);
        return <></>;
    }
};
