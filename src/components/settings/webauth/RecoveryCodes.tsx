import { useTranslation } from "react-i18next";
import { Alert, Button, Flex, Typography, theme } from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { useToken } = theme;

/** Shows freshly created recovery codes once, with copy and download. */
export const RecoveryCodes = ({ codes, username }: { codes: string[]; username: string }) => {
    const { t } = useTranslation();
    const { token } = useToken();
    const text = codes.join("\n");

    const copy = () => {
        void navigator.clipboard?.writeText(text).catch(() => undefined);
    };

    const download = () => {
        const blob = new Blob([`TeddyCloud recovery codes (${username})\n\n${text}\n`], {
            type: "text/plain",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `teddycloud-recovery-codes-${username}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Flex vertical gap={12}>
            <Alert type="warning" showIcon title={t("settings.webAuth.twoFactor.recoveryHint")} />
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 8,
                    padding: 12,
                    borderRadius: token.borderRadius,
                    background: token.colorFillTertiary,
                }}
            >
                {codes.map((code) => (
                    <Text key={code} code style={{ fontSize: 15 }}>
                        {code}
                    </Text>
                ))}
            </div>
            <Flex gap={8} wrap="wrap">
                <Button icon={<CopyOutlined />} onClick={copy} style={{ minHeight: 44 }}>
                    {t("settings.webAuth.twoFactor.copyCodes")}
                </Button>
                <Button icon={<DownloadOutlined />} onClick={download} style={{ minHeight: 44 }}>
                    {t("settings.webAuth.twoFactor.downloadCodes")}
                </Button>
            </Flex>
        </Flex>
    );
};
