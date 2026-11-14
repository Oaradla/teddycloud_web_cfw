import React, { useEffect, useState } from "react";
import { Alert, Form, Select, theme, Typography } from "antd";
import { ESP32Flasher } from "../hooks/useESP32Flasher";
import { useTranslation } from "react-i18next";
import DotAnimation from "../../../../../common/elements/DotAnimation";
import { cfwApi, CfwImage } from "../../../../../../api/cfwApi";
import { esp32Releases } from "../helper/cfwInstall";

const { Paragraph } = Typography;
const { useToken } = theme;

interface Step3Props {
    state: ESP32Flasher;
    setState: React.Dispatch<React.SetStateAction<ESP32Flasher>>;
    contentProgress: React.ReactNode;
}

const renderStateWithAnimation = (text: string) => {
    if (text.endsWith("...")) {
        const baseText = text.slice(0, -3);
        return (
            <div style={{ display: "flex" }}>
                {baseText}
                <DotAnimation />
            </div>
        );
    }
    return text;
};

export const Step3FlashESP32: React.FC<Step3Props> = ({ state, setState, contentProgress }) => {
    const { t } = useTranslation();
    const { token } = useToken();
    // null: CFW support is off (the library answers only with it on)
    const [releases, setReleases] = useState<CfwImage[] | null>([]);
    useEffect(() => {
        cfwApi
            .firmware()
            .then((r) => setReleases(esp32Releases(r.images)))
            .catch(() => setReleases(null));
    }, []);
    const k = "tonieboxes.esp32BoxFlashing.esp32flasher.";

    const stepStatusText = state.showStatus && (
        <div
            className="status"
            style={{ marginBottom: 16, color: state.error ? token.colorErrorText : "unset" }}
        >
            <i>{renderStateWithAnimation(state.state)}</i>
        </div>
    );

    return (
        <>
            <h3>{t("tonieboxes.esp32BoxFlashing.esp32flasher.titleFlashESP32")}</h3>
            {!state.actionInProgress && (
                <Paragraph>
                    <Alert
                        type="info"
                        description={t(
                            "tonieboxes.esp32BoxFlashing.esp32flasher.hintFlashESP32RevvoxFlasher",
                        )}
                    />
                </Paragraph>
            )}
            {!state.actionInProgress && !state.proceed && !state.resetBox && (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                    <Form.Item label={t(k + "cfwFirmware")}>
                        <Select
                            value={state.cfwBuild}
                            onChange={(cfwBuild) => setState((prev) => ({ ...prev, cfwBuild }))}
                            options={[
                                { value: 0, label: t(k + "cfwOriginal") },
                                ...(releases?.length
                                    ? []
                                    : [{ value: -1, label: t(k + "cfwCustom"), disabled: true }]),
                                ...(releases ?? []).map((r) => ({
                                    value: r.build,
                                    label: `${t(k + "cfwCustom")} ${r.version || r.build} (${r.channel})`,
                                })),
                            ]}
                        />
                    </Form.Item>
                    {!releases?.length && (
                        <Paragraph type="secondary">
                            {t(k + (releases ? "cfwNoImage" : "cfwSupportOff"))}
                        </Paragraph>
                    )}
                    {state.cfwBuild !== 0 && (
                        <Paragraph>
                            <Alert type="warning" showIcon description={t(k + "cfwHint")} />
                        </Paragraph>
                    )}
                </Form>
            )}
            {stepStatusText}
            {!state.actionInProgress && state.downloadLinkPatched ? (
                <div style={{ marginBottom: 16 }}>
                    <a
                        href={state.downloadLinkPatched}
                        download={"patched_" + state.filename}
                        title={"patched_" + state.filename}
                    >
                        {t("tonieboxes.esp32BoxFlashing.esp32flasher.downloadLinkPatched")}
                    </a>
                </div>
            ) : (
                ""
            )}
            {contentProgress}
        </>
    );
};
