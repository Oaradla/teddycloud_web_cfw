import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Flex, Form, Input, Table, Tag, Typography } from "antd";

import { useAuth } from "../../../provider/AuthProvider";
import {
    changeAuthPassword,
    disableTwoFactor,
    fetchSessions,
    renewRecoveryCodes,
    revokeOtherSessions,
    revokeSession,
    type AuthSession,
} from "../../../utils/auth/webAuthApi";
import { RecoveryCodes } from "./RecoveryCodes";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { authErrorText, formatTime, shortUserAgent } from "./authFormat";

const { Title, Paragraph, Text } = Typography;

type Mode = "none" | "setup" | "disable" | "renew" | "password";

/** Settings of the logged-in user: 2FA, recovery codes, password, sessions. */
export const AccountSecurity = () => {
    const { t } = useTranslation();
    const auth = useAuth();
    const [mode, setMode] = useState<Mode>("none");
    const [codes, setCodes] = useState<string[] | null>(null);
    const [sessions, setSessions] = useState<AuthSession[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const loadSessions = async () => {
        try {
            setSessions(await fetchSessions());
        } catch {
            /* shown as empty */
        }
    };

    useEffect(() => {
        void loadSessions();
    }, []);

    const run = async (action: () => Promise<void>) => {
        setError(null);
        setInfo(null);
        setBusy(true);
        try {
            await action();
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setBusy(false);
        }
    };

    const close = () => {
        setMode("none");
        setError(null);
    };

    const codeField = (
        <Form.Item
            name="code"
            label={t("settings.webAuth.twoFactor.codeOrRecovery")}
            rules={[{ required: true, message: t("auth.twoFactorCodeInvalid") }]}
        >
            <Input autoComplete="one-time-code" style={{ minHeight: 44 }} />
        </Form.Item>
    );

    const passwordField = (
        <Form.Item
            name="password"
            label={t("settings.webAuth.currentPassword")}
            rules={[{ required: true, message: t("auth.passwordRequired") }]}
        >
            <Input.Password autoComplete="current-password" style={{ minHeight: 44 }} />
        </Form.Item>
    );

    return (
        <Card style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginTop: 0 }}>
                {t("settings.webAuth.account.title", { username: auth.username })}
            </Title>
            {error ? (
                <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />
            ) : null}
            {info ? (
                <Alert type="success" showIcon title={info} style={{ marginBottom: 12 }} />
            ) : null}

            <Flex align="center" gap={8} wrap="wrap" style={{ marginBottom: 12 }}>
                <Text strong>{t("settings.webAuth.twoFactor.title")}</Text>
                {auth.twoFactorEnabled ? (
                    <Tag color="green">{t("settings.webAuth.twoFactor.on")}</Tag>
                ) : (
                    <Tag color={auth.twoFactorRequired ? "red" : "default"}>
                        {t("settings.webAuth.twoFactor.off")}
                    </Tag>
                )}
                {auth.twoFactorEnabled ? (
                    <Text type={auth.recoveryCodesLeft < 3 ? "danger" : "secondary"}>
                        {t("settings.webAuth.twoFactor.codesLeft", {
                            count: auth.recoveryCodesLeft,
                        })}
                    </Text>
                ) : null}
            </Flex>

            {codes ? (
                <Flex vertical gap={12} style={{ marginBottom: 16 }}>
                    <RecoveryCodes codes={codes} username={auth.username} />
                    <Button
                        type="primary"
                        onClick={() => setCodes(null)}
                        style={{ minHeight: 44, alignSelf: "flex-start" }}
                    >
                        {t("settings.webAuth.twoFactor.codesSaved")}
                    </Button>
                </Flex>
            ) : null}

            {mode === "setup" ? (
                <div style={{ maxWidth: 420, marginBottom: 16 }}>
                    <TwoFactorSetup
                        username={auth.username}
                        onCancel={close}
                        onFinished={() => {
                            close();
                            void auth.refresh().catch(() => undefined);
                            void loadSessions();
                        }}
                    />
                </div>
            ) : null}

            {mode === "disable" || mode === "renew" ? (
                <Form
                    layout="vertical"
                    style={{ maxWidth: 420, marginBottom: 16 }}
                    requiredMark={false}
                    onFinish={(values: { password: string; code: string }) =>
                        run(async () => {
                            if (mode === "disable") {
                                await disableTwoFactor(values.password, values.code);
                                setInfo(t("settings.webAuth.twoFactor.disabled"));
                            } else {
                                setCodes(await renewRecoveryCodes(values.password, values.code));
                            }
                            close();
                            await auth.refresh();
                        })
                    }
                >
                    <Paragraph>
                        {mode === "disable"
                            ? t("settings.webAuth.twoFactor.disableHint")
                            : t("settings.webAuth.twoFactor.renewHint")}
                    </Paragraph>
                    {passwordField}
                    {codeField}
                    <Flex gap={8}>
                        <Button
                            type="primary"
                            danger={mode === "disable"}
                            htmlType="submit"
                            loading={busy}
                            style={{ minHeight: 44 }}
                        >
                            {mode === "disable"
                                ? t("settings.webAuth.twoFactor.disable")
                                : t("settings.webAuth.twoFactor.renew")}
                        </Button>
                        <Button onClick={close} style={{ minHeight: 44 }}>
                            {t("common.cancel")}
                        </Button>
                    </Flex>
                </Form>
            ) : null}

            {mode === "password" ? (
                <Form
                    layout="vertical"
                    style={{ maxWidth: 420, marginBottom: 16 }}
                    requiredMark={false}
                    onFinish={(values: { password: string; newPassword: string }) =>
                        run(async () => {
                            const result = await changeAuthPassword(
                                auth.username,
                                values.newPassword,
                                values.password,
                            );
                            setInfo(
                                t("settings.webAuth.account.passwordChanged", {
                                    count: result.sessionsRevoked,
                                }),
                            );
                            close();
                            await loadSessions();
                        })
                    }
                >
                    {passwordField}
                    <Form.Item
                        name="newPassword"
                        label={t("auth.newPassword")}
                        rules={[
                            { required: true, message: t("auth.passwordRequired") },
                            {
                                min: auth.passwordMinLength,
                                message: t("auth.passwordMinLength", {
                                    count: auth.passwordMinLength,
                                }),
                            },
                        ]}
                    >
                        <Input.Password autoComplete="new-password" style={{ minHeight: 44 }} />
                    </Form.Item>
                    <Flex gap={8}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={busy}
                            style={{ minHeight: 44 }}
                        >
                            {t("settings.webAuth.changePassword")}
                        </Button>
                        <Button onClick={close} style={{ minHeight: 44 }}>
                            {t("common.cancel")}
                        </Button>
                    </Flex>
                </Form>
            ) : null}

            {mode === "none" ? (
                <Flex gap={8} wrap="wrap" style={{ marginBottom: 16 }}>
                    {auth.twoFactorEnabled ? (
                        <>
                            <Button onClick={() => setMode("renew")} style={{ minHeight: 44 }}>
                                {t("settings.webAuth.twoFactor.renew")}
                            </Button>
                            {!auth.twoFactorRequired ? (
                                <Button
                                    danger
                                    onClick={() => setMode("disable")}
                                    style={{ minHeight: 44 }}
                                >
                                    {t("settings.webAuth.twoFactor.disable")}
                                </Button>
                            ) : null}
                        </>
                    ) : (
                        <Button
                            type="primary"
                            onClick={() => setMode("setup")}
                            style={{ minHeight: 44 }}
                        >
                            {t("settings.webAuth.twoFactor.setUp")}
                        </Button>
                    )}
                    <Button onClick={() => setMode("password")} style={{ minHeight: 44 }}>
                        {t("settings.webAuth.changePassword")}
                    </Button>
                </Flex>
            ) : null}

            <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                <Text strong>{t("settings.webAuth.sessions.title")}</Text>
                <Button
                    onClick={() =>
                        run(async () => {
                            const n = await revokeOtherSessions();
                            setInfo(t("settings.webAuth.sessions.revoked", { count: n }));
                            await loadSessions();
                        })
                    }
                    disabled={sessions.filter((s) => !s.current).length === 0}
                    style={{ minHeight: 44 }}
                >
                    {t("settings.webAuth.sessions.revokeOthers")}
                </Button>
            </Flex>
            <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={sessions}
                scroll={{ x: true }}
                style={{ marginTop: 8 }}
                columns={[
                    {
                        title: t("settings.webAuth.sessions.device"),
                        key: "device",
                        render: (_: unknown, s: AuthSession) => (
                            <Flex gap={6} wrap="wrap" align="center">
                                <span>{shortUserAgent(s.userAgent) || "-"}</span>
                                {s.current ? (
                                    <Tag color="blue">{t("settings.webAuth.sessions.current")}</Tag>
                                ) : null}
                            </Flex>
                        ),
                    },
                    { title: t("settings.webAuth.sessions.ip"), dataIndex: "ip" },
                    {
                        title: t("settings.webAuth.sessions.lastSeen"),
                        key: "lastSeen",
                        render: (_: unknown, s: AuthSession) => formatTime(s.lastSeen, "-"),
                    },
                    {
                        title: "",
                        key: "actions",
                        render: (_: unknown, s: AuthSession) =>
                            s.current ? null : (
                                <Button
                                    type="link"
                                    danger
                                    onClick={() =>
                                        run(async () => {
                                            await revokeSession(s.id);
                                            await loadSessions();
                                        })
                                    }
                                >
                                    {t("settings.webAuth.sessions.revoke")}
                                </Button>
                            ),
                    },
                ]}
            />
        </Card>
    );
};
