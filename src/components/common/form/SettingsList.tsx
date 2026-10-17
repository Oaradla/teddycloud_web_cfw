import React from "react";
import { useTranslation } from "react-i18next";
import { OptionsItem } from "../../../api";
import { SettingsOptionItem } from "./SettingsOptionItem";
import { settingKey } from "./settingKey";

/** group titles sent by the server as entries of type "desc" */
export const settingGroupTitles = (options: OptionsItem[]) =>
    Object.fromEntries(options.filter((o) => o.type === "desc").map((o) => [o.iD, o.label]));

interface SettingsListProps {
    /** the settings to show, in server order, without group entries */
    options: OptionsItem[];
    titles: Record<string, string>;
    overlayId?: string;
    noOverlay?: boolean;
}

/** settings with a heading wherever a group starts (compared with the previous shown setting) */
export const SettingsList: React.FC<SettingsListProps> = ({
    options,
    titles,
    overlayId,
    noOverlay,
}) => {
    const { t } = useTranslation();
    const title = (path: string) =>
        t(`settings.groups.${settingKey(path)}`, { defaultValue: titles[path] || path });

    return (
        <>
            {options.map((option, index) => {
                const parts = option.iD.split(".");
                const previous = index > 0 ? options[index - 1].iD.split(".") : [];
                const headings = [];
                for (let level = 0; level < parts.length - 1; level++) {
                    const path = parts.slice(0, level + 1).join(".");
                    if (previous.slice(0, level + 1).join(".") === path) continue;
                    headings.push(
                        level === 0 ? (
                            <h3 key={`group-${path}`} style={{ marginBottom: 10 }}>
                                {title(path)}
                            </h3>
                        ) : (
                            <h4
                                key={`group-${path}`}
                                style={{ marginLeft: level * 10, marginTop: 10, marginBottom: 10 }}
                            >
                                {title(path)}
                            </h4>
                        ),
                    );
                }
                return (
                    <React.Fragment key={option.iD}>
                        {headings}
                        <SettingsOptionItem
                            iD={option.iD}
                            overlayId={overlayId}
                            noOverlay={noOverlay}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
};
