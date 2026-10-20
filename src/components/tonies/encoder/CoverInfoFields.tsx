import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, Input, Space, Typography, Upload } from "antd";
import { DeleteOutlined, PictureOutlined } from "@ant-design/icons";

import type { CoverInfo } from "./utils/coverModel";

const { Text } = Typography;

/**
 * optional with an encoding: a cover and the names for a custom model of the new TAF; the chapter
 * names come from the audio files
 */
export const CoverInfoFields: React.FC<{
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    value: CoverInfo;
    onChange: (value: CoverInfo) => void;
    /** the series when none is typed */
    defaultSeries: string;
    disabled?: boolean;
}> = ({ enabled, onEnabledChange, value, onChange, defaultSeries, disabled }) => {
    const { t } = useTranslation();
    const coverUrl = useMemo(
        () => (value.cover ? URL.createObjectURL(value.cover) : ""),
        [value.cover],
    );
    useEffect(() => () => (coverUrl ? URL.revokeObjectURL(coverUrl) : undefined), [coverUrl]);

    return (
        <Space orientation="vertical" style={{ width: "100%" }}>
            <Checkbox
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
                disabled={disabled}
            >
                {t("tonies.encoder.cover.enable")}
            </Checkbox>
            {enabled && (
                <div
                    style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}
                >
                    <Upload
                        accept="image/*"
                        showUploadList={false}
                        disabled={disabled}
                        beforeUpload={(file) => {
                            onChange({ ...value, cover: file });
                            return false;
                        }}
                    >
                        <div
                            style={{
                                width: 96,
                                height: 96,
                                border: "1px dashed #d9d9d9",
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                cursor: disabled ? "not-allowed" : "pointer",
                            }}
                            title={t("tonies.encoder.cover.choose")}
                        >
                            {coverUrl ? (
                                <img
                                    src={coverUrl}
                                    alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            ) : (
                                <Space orientation="vertical" align="center" size={2}>
                                    <PictureOutlined style={{ fontSize: 24 }} />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {t("tonies.encoder.cover.choose")}
                                    </Text>
                                </Space>
                            )}
                        </div>
                    </Upload>
                    <Space orientation="vertical" size={4} style={{ flex: 1, minWidth: 220 }}>
                        <Text>{t("tonies.encoder.cover.series")}</Text>
                        <Input
                            placeholder={defaultSeries}
                            value={value.series}
                            onChange={(e) => onChange({ ...value, series: e.target.value })}
                            disabled={disabled}
                        />
                        <Text>{t("tonies.encoder.cover.episodes")}</Text>
                        <Input
                            value={value.episodes}
                            onChange={(e) => onChange({ ...value, episodes: e.target.value })}
                            disabled={disabled}
                        />
                        {value.cover && (
                            <Button
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => onChange({ ...value, cover: null })}
                                disabled={disabled}
                            >
                                {t("tonies.encoder.cover.remove")}
                            </Button>
                        )}
                        <Text type="secondary">{t("tonies.encoder.cover.hint")}</Text>
                    </Space>
                </div>
            )}
        </Space>
    );
};
