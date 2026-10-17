import { Checkbox, Select, Space } from "antd";
import FormItem from "antd/es/form/FormItem";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SettingsDataHandler from "../../../data/SettingsDataHandler";
import { settingKey } from "./settingKey";

type SelectFieldProps = {
    name: string;
    label?: string;
    description?: string;
    values: { value: number; label: string }[];
    overlayed?: boolean;
    overlayId?: string;
};

/** an unsigned setting with a fixed set of values (the server sends them as "values") */
export const SettingsSelectField: React.FC<SelectFieldProps> = (props) => {
    const { t } = useTranslation();
    const { name, label, description, values, overlayed: initialOverlayed } = props;
    const [overlayed, setOverlayed] = useState<boolean | undefined>(initialOverlayed);
    const [fieldValue, setFieldValue] = useState(
        SettingsDataHandler.getInstance().getSetting(name)?.value,
    );

    // overlay-capable fields (the box dialog) get the overlay state of the setting, others none
    const overlayable = initialOverlayed !== undefined;
    useEffect(() => {
        const handler = SettingsDataHandler.getInstance();
        const idListener = () => {
            setFieldValue(handler.getSetting(name)?.value);
            setOverlayed(overlayable ? handler.getSetting(name)?.overlayed : undefined);
        };
        handler.addIdListener(idListener, name);
        return () => handler.removeIdListener(idListener);
    }, [name, overlayable]);

    const options = values.map((v) => ({
        value: v.value,
        label: t(`settings.values.${settingKey(name)}.${v.value}`, {
            defaultValue: v.label,
        }),
    }));

    return (
        <FormItem
            label={<span style={{ textWrap: "auto", lineHeight: "1.2" }}>{label}</span>}
            tooltip={description}
        >
            <Space.Compact>
                <Select
                    style={{ minWidth: 200 }}
                    value={fieldValue === undefined ? undefined : Number(fieldValue)}
                    options={options}
                    onChange={(value) => {
                        SettingsDataHandler.getInstance().changeSetting(name, value, overlayed);
                        setFieldValue(SettingsDataHandler.getInstance().getSetting(name)?.value);
                    }}
                    disabled={!overlayed && overlayed !== undefined}
                />
                {overlayed === undefined ? null : (
                    <Checkbox
                        checked={overlayed}
                        onChange={(event) => {
                            SettingsDataHandler.getInstance().changeSettingOverlayed(
                                name,
                                event.target.checked,
                            );
                            setOverlayed(
                                SettingsDataHandler.getInstance().getSetting(name)?.overlayed,
                            );
                        }}
                        style={{ marginLeft: 16, alignItems: "center" }}
                    >
                        {t("settings.overlayed")}
                    </Checkbox>
                )}
            </Space.Compact>
        </FormItem>
    );
};
