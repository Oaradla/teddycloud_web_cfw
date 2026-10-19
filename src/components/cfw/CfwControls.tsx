import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Collapse, Typography } from "antd";

const { Paragraph, Text } = Typography;

/** the further functions, below the upside-down slap that no other documentation mentions */
const SECTIONS = ["bothEars", "anyTag", "event", "locks"];

/** how a box with the custom firmware is used beyond the original: a quiet closed line at the bottom of the page */
export const CfwControls: React.FC = () => {
    const { t } = useTranslation();
    return (
        <Collapse
            ghost
            size="small"
            style={{ marginTop: 16 }}
            items={[
                {
                    key: "controls",
                    label: <Text type="secondary">{t("cfw.controls.title")}</Text>,
                    children: (
                        <>
                            <Paragraph type="secondary">{t("cfw.controls.intro")}</Paragraph>
                            <Alert
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                                title={t("cfw.controls.restart.title")}
                                description={t("cfw.controls.restart.text")}
                            />
                            {SECTIONS.map((key) => (
                                <Paragraph key={key}>
                                    <strong>{t(`cfw.controls.${key}.title`)}</strong>
                                    <br />
                                    {t(`cfw.controls.${key}.text`)}
                                </Paragraph>
                            ))}
                        </>
                    ),
                },
            ]}
        />
    );
};
