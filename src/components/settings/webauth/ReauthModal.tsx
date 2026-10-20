import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Form, Input, Modal, Typography } from "antd";

import { registerReauthHandler } from "../../../utils/auth/reauth";
import { confirmIdentity } from "../../../utils/auth/webAuthApi";
import { authErrorText } from "./authFormat";

/** Asks for the password (and 2FA code) when the server wants a fresh confirmation. */
export const ReauthModal = ({ twoFactor }: { twoFactor: boolean }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolver = useRef<((ok: boolean) => void) | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        registerReauthHandler(
            () =>
                new Promise<boolean>((resolve) => {
                    resolver.current = resolve;
                    setError(null);
                    form.resetFields();
                    setOpen(true);
                }),
        );
        return () => registerReauthHandler(null);
    }, [form]);

    const finish = (ok: boolean) => {
        setOpen(false);
        resolver.current?.(ok);
        resolver.current = null;
    };

    const submit = async () => {
        const values = await form.validateFields();
        setBusy(true);
        setError(null);
        try {
            await confirmIdentity(values.password, values.code);
            finish(true);
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title={t("settings.webAuth.reauth.title")}
            okText={t("settings.webAuth.reauth.confirm")}
            cancelText={t("common.cancel")}
            confirmLoading={busy}
            onOk={() => void submit()}
            onCancel={() => finish(false)}
            destroyOnHidden
        >
            <Typography.Paragraph>{t("settings.webAuth.reauth.hint")}</Typography.Paragraph>
            {error ? (
                <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />
            ) : null}
            <Form form={form} layout="vertical" requiredMark={false} onFinish={() => void submit()}>
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
                {twoFactor ? (
                    <Form.Item
                        name="code"
                        label={t("settings.webAuth.twoFactor.codeOrRecovery")}
                        rules={[{ required: true, message: t("auth.twoFactorCodeInvalid") }]}
                    >
                        <Input autoComplete="one-time-code" style={{ minHeight: 44 }} />
                    </Form.Item>
                ) : null}
                <button type="submit" hidden />
            </Form>
        </Modal>
    );
};
