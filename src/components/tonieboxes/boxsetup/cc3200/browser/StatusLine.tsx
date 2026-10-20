import { useTranslation } from "react-i18next";
import { Progress, Space, Typography } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
    MinusCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export type StepResult = { ok: boolean; text: string } | null;

/** whether something runs right now, and how the last action ended */
export function StatusLine({
    busy,
    text,
    progress = 0,
    result,
}: {
    busy: boolean;
    text?: string;
    progress?: number;
    result: StepResult;
}) {
    const { t } = useTranslation();
    const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    const k = "tonieboxes.cc3200BoxFlashing.browser.";
    return (
        <div role="status" aria-live="polite" style={{ marginTop: 16 }}>
            <Space>
                {busy ? (
                    <LoadingOutlined />
                ) : result ? (
                    result.ok ? (
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                        <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )
                ) : (
                    <MinusCircleOutlined />
                )}
                <Text type={!busy && result && !result.ok ? "danger" : undefined}>
                    {busy
                        ? `${t(k + "statusRunning")}: ${text || t(k + "statusWorking")}`
                        : result
                          ? `${result.ok ? t(k + "statusDone") : t(k + "statusFailed")}: ${result.text}`
                          : t(k + "statusIdle")}
                </Text>
            </Space>
            {busy && percent > 0 && <Progress percent={percent} size="small" />}
        </div>
    );
}
