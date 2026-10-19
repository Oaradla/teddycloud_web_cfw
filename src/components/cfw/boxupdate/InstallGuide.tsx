import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Collapse, Typography } from "antd";

const { Paragraph, Text } = Typography;

const Steps = ({ prefix, count }: { prefix: string; count: number }) => {
    const host = window.location.hostname;
    return (
        <ol style={{ paddingInlineStart: 20 }}>
            {Array.from({ length: count }, (_, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                    <Trans
                        i18nKey={`${prefix}.step${i + 1}`}
                        values={{ host }}
                        components={{
                            code: <Text code />,
                            setup: <Link to="/tonieboxes/boxsetup" />,
                        }}
                    />
                </li>
            ))}
        </ol>
    );
};

/**
 * how a box with the original firmware gets the custom firmware, per chip; open at the top of the
 * page while no box runs the custom firmware, closed at the bottom afterwards
 */
export const InstallGuide: React.FC<{ open: boolean }> = ({ open }) => {
    const { t } = useTranslation();
    return (
        <Collapse
            style={{ marginBottom: 16 }}
            defaultActiveKey={open ? ["guide"] : []}
            items={[
                {
                    key: "guide",
                    label: t("cfw.update.guide.title"),
                    children: (
                        <>
                            <Paragraph>
                                <Trans
                                    i18nKey="cfw.update.guide.intro"
                                    components={{
                                        identify: (
                                            <Link to="/tonieboxes/boxsetup/identifyboxversion" />
                                        ),
                                    }}
                                />
                            </Paragraph>
                            <Collapse
                                ghost
                                defaultActiveKey={open ? ["cc3200", "esp32"] : []}
                                items={[
                                    {
                                        key: "cc3200",
                                        label: (
                                            <strong>{t("cfw.update.guide.cc3200.title")}</strong>
                                        ),
                                        children: (
                                            <Steps prefix="cfw.update.guide.cc3200" count={7} />
                                        ),
                                    },
                                    {
                                        key: "esp32",
                                        label: <strong>{t("cfw.update.guide.esp32.title")}</strong>,
                                        children: (
                                            <Steps prefix="cfw.update.guide.esp32" count={6} />
                                        ),
                                    },
                                ]}
                            />
                        </>
                    ),
                },
            ]}
        />
    );
};
