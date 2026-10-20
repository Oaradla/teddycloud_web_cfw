import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Flex, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import {
    fetchAuthEvents,
    unlockLogin,
    type AuthEvent,
    type AuthEventsResponse,
} from "../../../utils/auth/webAuthApi";
import { authErrorText, formatTime } from "./authFormat";

const { Title, Text } = Typography;

const dangerous = new Set([
    "login_failed",
    "ip_locked",
    "account_locked",
    "2fa_reset",
    "2fa_disabled",
    "recovery_code_used",
]);

/** Recent logins, failures and lockouts since the server start. */
export const SecurityEvents = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<AuthEventsResponse>({ events: [], lockedAddresses: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            setData(await fetchAuthEvents());
            setError(null);
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const typeLabel = (type: string) => {
        const key = `settings.webAuth.events.types.${type}`;
        const translated = t(key);
        return translated !== key ? translated : type;
    };

    return (
        <Card style={{ marginBottom: 24 }}>
            <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                <Title level={4} style={{ margin: 0 }}>
                    {t("settings.webAuth.events.title")}
                </Title>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void load()}
                    style={{ minHeight: 44 }}
                >
                    {t("settings.webAuth.events.reload")}
                </Button>
            </Flex>
            <Text type="secondary">{t("settings.webAuth.events.hint")}</Text>
            {error ? <Alert type="error" showIcon title={error} style={{ marginTop: 12 }} /> : null}
            {data.lockedAddresses.length > 0 ? (
                <Flex vertical gap={8} style={{ marginTop: 12 }}>
                    <Text strong>{t("settings.webAuth.events.locked")}</Text>
                    {data.lockedAddresses.map((entry) => (
                        <Flex key={entry.ip} gap={8} align="center" wrap="wrap">
                            <Text code>{entry.ip}</Text>
                            <Text type="secondary">
                                {t("settings.webAuth.events.lockedUntil", {
                                    time: formatTime(entry.lockedUntil, "-"),
                                })}
                            </Text>
                            <Button
                                size="small"
                                onClick={() =>
                                    void unlockLogin({ ip: entry.ip })
                                        .then(load)
                                        .catch((err) => setError(authErrorText(t, err)))
                                }
                            >
                                {t("settings.webAuth.events.unlock")}
                            </Button>
                        </Flex>
                    ))}
                </Flex>
            ) : null}
            <Table
                size="small"
                loading={loading}
                rowKey={(e: AuthEvent) => `${e.time}-${e.type}-${e.ip}-${e.username}-${e.detail}`}
                dataSource={data.events}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: true }}
                style={{ marginTop: 12 }}
                columns={[
                    {
                        title: t("settings.webAuth.events.time"),
                        key: "time",
                        render: (_: unknown, e: AuthEvent) => formatTime(e.time, "-"),
                    },
                    {
                        title: t("settings.webAuth.events.type"),
                        key: "type",
                        render: (_: unknown, e: AuthEvent) => (
                            <Tag color={dangerous.has(e.type) ? "red" : "default"}>
                                {typeLabel(e.type)}
                            </Tag>
                        ),
                    },
                    { title: t("auth.username"), dataIndex: "username" },
                    { title: t("settings.webAuth.sessions.ip"), dataIndex: "ip" },
                    { title: t("settings.webAuth.events.detail"), dataIndex: "detail" },
                ]}
            />
        </Card>
    );
};
