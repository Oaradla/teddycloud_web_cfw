import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip, Typography } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";

import { useTeddyCloud } from "../../../../provider/TeddyCloudProvider";
import { useAudioContext } from "../../../../provider/AudioProvider";
import { NotificationTypeEnum } from "../../../../types/teddyCloudNotificationTypes";
import { useRadioStreamSearch } from "../hooks/useRadioStreamSearch";
import { useDebouncedCallback } from "../../common/hooks/useDebouncedCallback";
import { SearchDropdownOption, SearchDropdown } from "../../../common/elements/SearchDropdown";

const { Paragraph } = Typography;

export const RadioStreamSearch: React.FC<{
    placeholder: string;
    onChange: (newValue: string) => void;
}> = ({ placeholder, onChange }) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const { playAudio } = useAudioContext();

    const {
        value,
        options,
        search,
        select,
        setValue,
        isRadioBrowserApiAvailable,
        radioBrowserAPIBaseJsonUrl,
    } = useRadioStreamSearch((error) => {
        addNotification(
            NotificationTypeEnum.Error,
            t("radioStreamSearch.failedToFetchSearchResults"),
            t("radioStreamSearch.failedToFetchSearchResultsDetails") + String(error),
            t("tonies.title"),
        );
    });

    const [searchText, setSearchText] = useState(value ?? "");

    const debouncedSearch = useDebouncedCallback(search, 300);

    const handleInputChange = (text: string) => {
        setSearchText(text);
        debouncedSearch(text);
    };

    const handleSelect = (newValue: string) => {
        setValue(newValue);
        select(newValue);
        onChange(newValue);

        const match = options.find((o) => o.value === newValue);
        if (match) {
            setSearchText(match.text);
        }
    };

    if (!isRadioBrowserApiAvailable || !radioBrowserAPIBaseJsonUrl) {
        return null;
    }

    const dropdownOptions: SearchDropdownOption[] = options.map((d) => ({
        value: d.value,
        label: (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{d.text}</span>
                <Tooltip title={t("radioStreamSearch.preview")}>
                    <Button
                        type="text"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        aria-label={t("radioStreamSearch.preview")}
                        onClick={(e) => {
                            e.stopPropagation();
                            playAudio(d.value, {
                                series: d.text,
                                episode: t("radioStreamSearch.preview"),
                                picture: d.favicon || "/img_unknown.png",
                            });
                        }}
                    />
                </Tooltip>
            </span>
        ),
    }));

    return (
        <>
            <Paragraph style={{ fontSize: "small", display: "inline-block", marginTop: 8 }}>
                {t("radioStreamSearch.searchLabel")}
            </Paragraph>

            <SearchDropdown
                value={searchText}
                placeholder={placeholder}
                options={dropdownOptions}
                onInputChange={handleInputChange}
                onSelect={handleSelect}
                noResultsContent={t("radioStreamSearch.noResults")}
                allowClear
                style={{ width: "100%" }}
            />
        </>
    );
};
