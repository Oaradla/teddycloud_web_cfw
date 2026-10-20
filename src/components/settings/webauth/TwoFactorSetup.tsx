import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Flex, Form, Input, QRCode, Typography } from "antd";

import {
    AuthApiError,
    enableTwoFactor,
    startTwoFactorSetup,
    type TwoFactorSetup as SetupData,
} from "../../../utils/auth/webAuthApi";
import { RecoveryCodes } from "./RecoveryCodes";

const { Paragraph, Text } = Typography;

type Props = {
    username: string;
    /** called after the recovery codes were acknowledged */
    onFinished: () => void;
    onCancel?: () => void;
};

/** Password, then QR code and first code, then the recovery codes. */
export const TwoFactorSetup = ({ username, onFinished, onCancel }: Props) => {
    const { t } = useTranslation();
    const [setup, setSetup] = useState<SetupData | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const errorText = (err: unknown) => {
        if (err instanceof AuthApiError) {
            const key = `settings.webAuth.errors.${err.code}`;
            const translated = t(key);
            return translated !== key ? translated : err.message;
        }
        return err instanceof Error ? err.message : t("settings.webAuth.saveFailed");
    };

    const start = async (values: { password: string }) => {
        setError(null);
        setBusy(true);
        try {
            setSetup(await startTwoFactorSetup(values.password));
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    const confirm = async (values: { code: string }) => {
        setError(null);
        setBusy(true);
        try {
            setCodes(await enableTwoFactor(values.code.replace(/\s/g, "")));
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Flex vertical gap={12}>
            {error ? <Alert type="error" showIcon title={error} /> : null}
            {codes ? (
                <>
                    <Alert
                        type="success"
                        showIcon
                        title={t("settings.webAuth.twoFactor.enabled")}
                    />
                    <RecoveryCodes codes={codes} username={username} />
                    <Button type="primary" onClick={onFinished} style={{ minHeight: 44 }}>
                        {t("settings.webAuth.twoFactor.codesSaved")}
                    </Button>
                </>
            ) : setup ? (
                <>
                    <Paragraph style={{ margin: 0 }}>
                        {t("settings.webAuth.twoFactor.scan")}
                    </Paragraph>
                    <Flex justify="center">
                        <QRCode
                            value={setup.otpauthUri}
                            size={200}
                            bgColor="#ffffff"
                            color="#000000"
                        />
                    </Flex>
                    <Text type="secondary">{t("settings.webAuth.twoFactor.manual")}</Text>
                    <Text code copyable={{ text: setup.secret }} style={{ wordBreak: "break-all" }}>
                        {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("settings.webAuth.twoFactor.manualParams")}
                    </Text>
                    <Form layout="vertical" onFinish={confirm} requiredMark={false}>
                        <Form.Item
                            name="code"
                            label={t("auth.twoFactorCode")}
                            rules={[
                                {
                                    required: true,
                                    pattern: /^\s*\d{3}\s?\d{3}\s*$/,
                                    message: t("auth.twoFactorCodeInvalid"),
                                },
                            ]}
                        >
                            <Input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={7}
                                autoFocus
                                style={{ minHeight: 44, letterSpacing: 4 }}
                            />
                        </Form.Item>
                        <Flex gap={8} wrap="wrap">
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={busy}
                                style={{ minHeight: 44 }}
                            >
                                {t("settings.webAuth.twoFactor.activate")}
                            </Button>
                            {onCancel ? (
                                <Button onClick={onCancel} style={{ minHeight: 44 }}>
                                    {t("common.cancel")}
                                </Button>
                            ) : null}
                        </Flex>
                    </Form>
                </>
            ) : (
                <Form layout="vertical" onFinish={start} requiredMark={false}>
                    <Paragraph>{t("settings.webAuth.twoFactor.intro")}</Paragraph>
                    <Form.Item
                        name="password"
                        label={t("settings.webAuth.currentPassword")}
                        rules={[{ required: true, message: t("auth.passwordRequired") }]}
                    >
                        <Input.Password
                            autoComplete="current-password"
                            autoFocus
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Flex gap={8} wrap="wrap">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={busy}
                            style={{ minHeight: 44 }}
                        >
                            {t("settings.webAuth.twoFactor.start")}
                        </Button>
                        {onCancel ? (
                            <Button onClick={onCancel} style={{ minHeight: 44 }}>
                                {t("common.cancel")}
                            </Button>
                        ) : null}
                    </Flex>
                </Form>
            )}
        </Flex>
    );
};
