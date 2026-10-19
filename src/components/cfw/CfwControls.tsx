import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Collapse, Typography } from "antd";

const { Paragraph } = Typography;

/** the further functions, below the upside-down slap that no other documentation mentions */
const SECTIONS = ["bothEars", "anyTag", "event", "locks"];

/** how a box with the custom firmware is used beyond the original: closed at the bottom of the page */
export const CfwControls: React.FC = () => {
    const { t } = useTranslation();
    return (
        <Collapse
            style={{ marginTop: 16 }}
            items={[
                {
                    key: "controls",
                    label: t("cfw.controls.title"),
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
