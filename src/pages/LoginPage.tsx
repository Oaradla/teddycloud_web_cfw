import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Flex, Form, Input, Typography, theme } from "antd";
import { KeyOutlined, LockOutlined, SafetyOutlined, UserOutlined } from "@ant-design/icons";

import { useAuth, type PendingSecondFactor } from "../provider/AuthProvider";
import { StyledLanguageSwitcher } from "../components/common/header/StyledLanguageSwitcher";
import { TwoFactorSetup } from "../components/settings/webauth/TwoFactorSetup";
import { authErrorText } from "../components/settings/webauth/authFormat";
import { AuthApiError, changeAuthPassword } from "../utils/auth/webAuthApi";
import logoImg from "../assets/logo.png";

const { useToken } = theme;
const { Title, Text } = Typography;

export const LoginPage = ({ themeSwitch }: { themeSwitch: ReactNode }) => {
    const { t } = useTranslation();
    const { token } = useToken();
    const {
        login,
        loginSecondFactor,
        needsTwoFactorSetup,
        needsPasswordChange,
        passwordMinLength,
        username,
        refresh,
        logout,
    } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [pending, setPending] = useState<PendingSecondFactor | null>(null);
    const [useRecovery, setUseRecovery] = useState(false);

    const describe = (err: unknown) => {
        if (err instanceof AuthApiError) {
            if (err.code === "rate_limited") {
                /* the server says how long the lock lasts */
                const seconds = err.retryAfter ?? 0;
                if (seconds > 0) {
                    const until = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                    return seconds < 90
                        ? t("auth.loginRateLimitedSeconds", { count: seconds, until })
                        : t("auth.loginRateLimitedMinutes", {
                              count: Math.ceil(seconds / 60),
                              until,
                          });
                }
                return t("auth.loginRateLimited");
            }
            if (err.code === "challenge_invalid") {
                setPending(null);
                return t("auth.twoFactorExpired");
            }
            if (err.code === "invalid_code") {
                return useRecovery ? t("auth.recoveryCodeWrong") : t("auth.twoFactorCodeWrong");
            }
            if (err.code === "busy") {
                return t("auth.loginBusy");
            }
            if (err.code === "forbidden" || err.code === "https_required") {
                return err.message;
            }
            return t("auth.loginFailed");
        }
        return err instanceof Error ? err.message : t("auth.loginFailed");
    };

    const onPassword = async (values: { username: string; password: string }) => {
        setError(null);
        setSubmitting(true);
        try {
            const next = await login(values.username.trim(), values.password);
            if (next) {
                setUseRecovery(false);
                setPending(next);
            }
        } catch (err) {
            setError(describe(err));
        } finally {
            setSubmitting(false);
        }
    };

    const onSecondFactor = async (values: { code: string }) => {
        if (!pending) {
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await loginSecondFactor(
                pending.challenge,
                useRecovery ? values.code.trim() : values.code.replace(/\s/g, ""),
                useRecovery ? "recovery" : "totp",
            );
        } catch (err) {
            setError(describe(err));
        } finally {
            setSubmitting(false);
        }
    };

    const onPasswordChange = async (values: { password: string; newPassword: string }) => {
        setError(null);
        setSubmitting(true);
        try {
            await changeAuthPassword(username, values.newPassword, values.password);
            await refresh();
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setSubmitting(false);
        }
    };

    const header = (title: string, hint: string) => (
        <Flex vertical align="center" gap={8} style={{ marginBottom: 16 }}>
            <img src={logoImg} alt="TeddyCloud" style={{ height: 40 }} />
            <Title level={3} style={{ margin: 0 }}>
                {title}
            </Title>
            <Text type="secondary" style={{ textAlign: "center" }}>
                {hint}
            </Text>
        </Flex>
    );

    let content: ReactNode;
    if (needsTwoFactorSetup) {
        content = (
            <>
                {header(t("auth.twoFactorSetupTitle"), t("auth.twoFactorSetupHint"))}
                <TwoFactorSetup
                    username={username}
                    onFinished={() => void refresh().catch(() => undefined)}
                    onCancel={() => void logout()}
                />
            </>
        );
    } else if (needsPasswordChange) {
        content = (
            <>
                {header(t("auth.passwordChangeTitle"), t("auth.passwordChangeHint"))}
                {error ? (
                    <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
                ) : null}
                <Form layout="vertical" onFinish={onPasswordChange} requiredMark={false}>
                    {/* lets password managers store the new password under the right user */}
                    <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={username}
                        readOnly
                        hidden
                    />
                    <Form.Item
                        name="password"
                        label={t("settings.webAuth.currentPassword")}
                        rules={[{ required: true, message: t("auth.passwordRequired") }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            autoComplete="current-password"
                            autoFocus
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Form.Item
                        name="newPassword"
                        label={t("auth.newPassword")}
                        extra={t("auth.passwordMinLength", { count: passwordMinLength })}
                        rules={[
                            { required: true, message: t("auth.passwordRequired") },
                            {
                                min: passwordMinLength,
                                message: t("auth.passwordMinLength", {
                                    count: passwordMinLength,
                                }),
                            },
                        ]}
                    >
                        <Input.Password
                            prefix={<KeyOutlined />}
                            autoComplete="new-password"
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Form.Item
                        name="repeatPassword"
                        label={t("auth.repeatPassword")}
                        dependencies={["newPassword"]}
                        rules={[
                            { required: true, message: t("auth.passwordRequired") },
                            ({ getFieldValue }) => ({
                                validator: (_, value) =>
                                    !value || value === getFieldValue("newPassword")
                                        ? Promise.resolve()
                                        : Promise.reject(new Error(t("auth.passwordMismatch"))),
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<KeyOutlined />}
                            autoComplete="new-password"
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={submitting}
                        block
                        style={{ minHeight: 44 }}
                    >
                        {t("settings.webAuth.changePassword")}
                    </Button>
                </Form>
                <Flex justify="flex-end" style={{ marginTop: 12 }}>
                    <Button
                        type="link"
                        style={{ paddingInline: 0, minHeight: 44 }}
                        onClick={() => void logout()}
                    >
                        {t("auth.backToLogin")}
                    </Button>
                </Flex>
            </>
        );
    } else if (pending) {
        content = (
            <>
                {header(
                    t("auth.twoFactorTitle"),
                    useRecovery ? t("auth.recoveryCodeHint") : t("auth.twoFactorHint"),
                )}
                {error ? (
                    <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
                ) : null}
                <Form
                    key={useRecovery ? "recovery" : "totp"}
                    layout="vertical"
                    onFinish={onSecondFactor}
                    requiredMark={false}
                >
                    <Form.Item
                        name="code"
                        label={useRecovery ? t("auth.recoveryCode") : t("auth.twoFactorCode")}
                        rules={
                            useRecovery
                                ? [{ required: true, message: t("auth.recoveryCodeRequired") }]
                                : [
                                      {
                                          required: true,
                                          pattern: /^\s*\d{3}\s?\d{3}\s*$/,
                                          message: t("auth.twoFactorCodeInvalid"),
                                      },
                                  ]
                        }
                    >
                        <Input
                            prefix={useRecovery ? <KeyOutlined /> : <SafetyOutlined />}
                            inputMode={useRecovery ? "text" : "numeric"}
                            autoComplete="one-time-code"
                            autoFocus
                            maxLength={useRecovery ? 16 : 7}
                            style={{ minHeight: 44, letterSpacing: useRecovery ? 1 : 4 }}
                        />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={submitting}
                        block
                        style={{ minHeight: 44 }}
                    >
                        {t("auth.twoFactorSubmit")}
                    </Button>
                </Form>
                <Flex justify="space-between" wrap="wrap" gap={8} style={{ marginTop: 12 }}>
                    <Button
                        type="link"
                        style={{ paddingInline: 0, minHeight: 44 }}
                        onClick={() => {
                            setError(null);
                            setUseRecovery(!useRecovery);
                        }}
                    >
                        {useRecovery ? t("auth.useTwoFactorCode") : t("auth.useRecoveryCode")}
                    </Button>
                    <Button
                        type="link"
                        style={{ paddingInline: 0, minHeight: 44 }}
                        onClick={() => {
                            setError(null);
                            setPending(null);
                        }}
                    >
                        {t("auth.backToLogin")}
                    </Button>
                </Flex>
            </>
        );
    } else {
        content = (
            <>
                {header(t("auth.loginTitle"), t("auth.loginHint"))}
                {error ? (
                    <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
                ) : null}
                <Form layout="vertical" onFinish={onPassword} requiredMark={false}>
                    <Form.Item
                        name="username"
                        label={t("auth.username")}
                        rules={[{ required: true, message: t("auth.usernameRequired") }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            autoComplete="username"
                            autoFocus
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label={t("auth.password")}
                        rules={[{ required: true, message: t("auth.passwordRequired") }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            autoComplete="current-password"
                            style={{ minHeight: 44 }}
                        />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={submitting}
                        block
                        style={{ minHeight: 44 }}
                    >
                        {t("auth.loginSubmit")}
                    </Button>
                </Form>
            </>
        );
    }

    return (
        <Flex
            vertical
            align="center"
            justify="center"
            style={{
                minHeight: "100vh",
                padding: 16,
                background: token.colorBgLayout,
            }}
        >
            <Flex
                align="center"
                justify="flex-end"
                gap={8}
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    left: 0,
                    padding: "12px 16px",
                    background: "#141414",
                }}
            >
                {themeSwitch}
                <StyledLanguageSwitcher />
            </Flex>
            <Card style={{ width: "100%", maxWidth: needsTwoFactorSetup ? 480 : 400 }}>
                {content}
            </Card>
        </Flex>
    );
};
