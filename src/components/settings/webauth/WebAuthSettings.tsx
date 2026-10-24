import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Button,
    Checkbox,
    Descriptions,
    Flex,
    Form,
    Input,
    Select,
    Switch,
    Table,
    Tag,
    Tooltip,
    Typography,
} from "antd";
import {
    DeleteOutlined,
    EditOutlined,
    LogoutOutlined,
    PlusOutlined,
    StopOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import ConfirmationDialog from "../../common/modals/ConfirmationModal";
import { useAuth } from "../../../provider/AuthProvider";
import { useTeddyCloud } from "../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../types/teddyCloudNotificationTypes";
import {
    changeAuthPassword,
    createAuthUser,
    deleteAuthUser,
    fetchAuthUsers,
    setAuthEnabled,
    updateAuthUser,
    type AuthUser,
} from "../../../utils/auth/webAuthApi";
import { AccountSecurity } from "./AccountSecurity";
import { UserGroups } from "./UserGroups";
import { useAcl } from "../../../provider/AclProvider";
import { SecurityEvents } from "./SecurityEvents";
import { UserDenyButton } from "./UserDenyButton";
import { UserOwned } from "./UserOwned";
import { useRightsTree } from "./useRightsTree";
import { authErrorText, formatTime } from "./authFormat";

const { Title, Paragraph, Text } = Typography;

export const WebAuthSettings = () => {
    const { t } = useTranslation();
    const auth = useAuth();
    const acl = useAcl();
    const levelOrder = ["admin", "user", "guest"];
    /* users create users of the same or a lower level */
    const allowedLevels = levelOrder.slice(Math.max(0, levelOrder.indexOf(acl.level)));
    const { refresh } = auth;
    const { addNotification } = useTeddyCloud();
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [envOverride, setEnvOverride] = useState(false);
    const [require2faAll, setRequire2faAll] = useState(false);
    const [minLength, setMinLength] = useState(10);
    const [maxUsers, setMaxUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [userToReset, setUserToReset] = useState<string | null>(null);
    const [passwordUser, setPasswordUser] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [createForm] = Form.useForm();

    const loggedIn = auth.enabled && auth.loggedIn;
    const rights = useRightsTree();
    const rightsTree = rights.tree;
    /* levels and own groups in one list: "user", "guest", "group:<id>" */
    const groupOptions = [
        ...allowedLevels.map((l) => ({ value: l, label: t(`sharing.levels.${l}`) })),
        ...(rights.catalog?.groups ?? [])
            .filter((g) => allowedLevels.includes(g.base))
            .map((g) => ({ value: `group:${g.id}`, label: g.name })),
    ];
    const groupValue = (u: AuthUser) => (u.group ? `group:${u.group}` : (u.level ?? "admin"));
    const groupLabel = (u: AuthUser) =>
        groupOptions.find((o) => o.value === groupValue(u))?.label ??
        t(`sharing.levels.${u.level ?? "admin"}`);
    const groupChange = (value: string) =>
        value.startsWith("group:") ? { group: value.slice(6) } : { level: value, group: "" };

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAuthUsers();
            setUsers(data.userDetails);
            setEnabled(data.enabled);
            setEnvOverride(data.envOverride);
            setRequire2faAll(data.require2faAll);
            setMinLength(data.passwordMinLength);
            setMaxUsers(data.maxUsers);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handle = async (action: () => Promise<void>) => {
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(authErrorText(t, err));
        }
    };

    const handleToggle = (checked: boolean) =>
        handle(async () => {
            await setAuthEnabled(checked);
            setEnabled(checked);
            await refresh();
            await load();
        });

    const handleCreate = (values: {
        username: string;
        password: string;
        lanOnly?: boolean;
        require2fa?: boolean;
        mustChangePassword?: boolean;
        level?: string;
    }) =>
        handle(async () => {
            await createAuthUser(values.username.trim(), values.password, {
                lanOnly: !!values.lanOnly,
                require2fa: !!values.require2fa,
                mustChangePassword: !!values.mustChangePassword,
                ...(values.level ? groupChange(values.level) : {}),
            });
            createForm.resetFields();
            await load();
        });

    const updateUser = (username: string, changes: Parameters<typeof updateAuthUser>[1]) =>
        handle(async () => {
            const result = await updateAuthUser(username, changes);
            setUsers((list) => list.map((u) => (u.username === username ? result.user : u)));
            if (changes.revokeSessions) {
                addNotification(
                    NotificationTypeEnum.Success,
                    t("settings.webAuth.sessions.revoked", { count: result.sessionsRevoked }),
                    username,
                    t("settings.webAuth.navigationTitle"),
                );
            }
        });

    const togglePasswordRow = (username: string) => {
        setError(null);
        setNewPassword("");
        setMustChangePassword(false);
        setPasswordUser((current) => (current === username ? null : username));
    };

    const savePassword = async () => {
        if (!passwordUser || newPassword.length < minLength) {
            return;
        }
        setError(null);
        setPasswordSaving(true);
        try {
            const self = isSelf(passwordUser);
            await changeAuthPassword(
                passwordUser,
                newPassword,
                undefined,
                !self && mustChangePassword,
            );
            if (!self) {
                setUsers((list) =>
                    list.map((u) =>
                        u.username === passwordUser ? { ...u, mustChangePassword } : u,
                    ),
                );
            }
            addNotification(
                NotificationTypeEnum.Success,
                t("settings.webAuth.passwordChanged"),
                t("settings.webAuth.passwordChangedDetails", { username: passwordUser }),
                t("settings.webAuth.navigationTitle"),
            );
            setPasswordUser(null);
            setNewPassword("");
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setPasswordSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!userToDelete) {
            return;
        }
        await handle(async () => {
            const result = await deleteAuthUser(userToDelete);
            if (passwordUser === userToDelete) {
                setPasswordUser(null);
                setNewPassword("");
            }
            setUserToDelete(null);
            await load();
            await refresh();
            if (result.authDisabled) {
                setEnabled(false);
            }
        });
    };

    const confirmReset = async () => {
        if (!userToReset) {
            return;
        }
        const username = userToReset;
        setUserToReset(null);
        await updateUser(username, { reset2fa: true });
    };

    const lastUser = users.length === 1;
    const isSelf = (username: string) =>
        loggedIn && username.toLowerCase() === auth.username.toLowerCase();
    const client = auth.client;

    return (
        <>
            <Title level={2}>{t("settings.webAuth.title")}</Title>
            <Paragraph>{t("settings.webAuth.intro")}</Paragraph>
            {envOverride ? (
                <Alert
                    type="warning"
                    showIcon
                    title={t("settings.webAuth.envOverride")}
                    style={{ marginBottom: 16 }}
                />
            ) : null}
            {error ? (
                <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
            ) : null}

            {acl.admin ? (
                <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
                    <Switch
                        checked={enabled}
                        disabled={envOverride || (users.length === 0 && !enabled)}
                        onChange={(checked) => void handleToggle(checked)}
                    />
                    <Text>{t("settings.webAuth.enabled")}</Text>
                </Flex>
            ) : null}
            {users.length === 0 && acl.admin ? (
                <Alert
                    type="info"
                    showIcon
                    title={t("settings.webAuth.createFirstUser")}
                    style={{ marginBottom: 16 }}
                />
            ) : null}

            {loggedIn ? <AccountSecurity /> : null}

            <Title level={4}>{t("settings.webAuth.users")}</Title>
            {require2faAll ? (
                <Alert
                    type="info"
                    showIcon
                    title={t("settings.webAuth.require2faAll")}
                    style={{ marginBottom: 12 }}
                />
            ) : null}
            <Table
                loading={loading}
                pagination={false}
                rowKey="username"
                dataSource={users}
                scroll={{ x: true }}
                expandable={{
                    expandedRowKeys: passwordUser ? [passwordUser] : [],
                    showExpandColumn: false,
                    expandedRowRender: (record: AuthUser) => (
                        <Flex gap={8} wrap="wrap" align="center">
                            <Input.Password
                                autoComplete="new-password"
                                placeholder={t("auth.newPassword")}
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                onPressEnter={() => void savePassword()}
                                style={{ minHeight: 44, minWidth: 200, flex: "1 1 200px" }}
                                aria-label={t("settings.webAuth.changePasswordFor", {
                                    username: record.username,
                                })}
                            />
                            <Button
                                type="primary"
                                loading={passwordSaving}
                                disabled={newPassword.length < minLength}
                                onClick={() => void savePassword()}
                                style={{ minHeight: 44 }}
                            >
                                {t("settings.webAuth.changePassword")}
                            </Button>
                            <Button
                                onClick={() => togglePasswordRow(record.username)}
                                style={{ minHeight: 44 }}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Text type="secondary">
                                {t("auth.passwordMinLength", { count: minLength })}
                            </Text>
                            {isSelf(record.username) ? null : (
                                <Checkbox
                                    checked={mustChangePassword}
                                    onChange={(event) =>
                                        setMustChangePassword(event.target.checked)
                                    }
                                >
                                    {t("settings.webAuth.mustChangePassword")}
                                </Checkbox>
                            )}
                        </Flex>
                    ),
                }}
                columns={[
                    {
                        title: t("auth.username"),
                        key: "username",
                        render: (_: unknown, u: AuthUser) => (
                            <Flex gap={6} wrap="wrap" align="center">
                                <span>{u.username}</span>
                                {isSelf(u.username) ? (
                                    <Tag color="blue">{t("settings.webAuth.you")}</Tag>
                                ) : null}
                                {u.mustChangePassword ? (
                                    <Tooltip title={t("settings.webAuth.mustChangePasswordHint")}>
                                        <Tag
                                            color="orange"
                                            closable={!isSelf(u.username)}
                                            onClose={(event) => {
                                                event.preventDefault();
                                                void updateUser(u.username, {
                                                    mustChangePassword: false,
                                                });
                                            }}
                                        >
                                            {t("settings.webAuth.mustChangePasswordPending")}
                                        </Tag>
                                    </Tooltip>
                                ) : null}
                                {u.legacyHash ? (
                                    <Tooltip title={t("settings.webAuth.legacyHashHint")}>
                                        <Tag color="orange">{t("settings.webAuth.legacyHash")}</Tag>
                                    </Tooltip>
                                ) : null}
                            </Flex>
                        ),
                    },
                    {
                        title: t("settings.webAuth.level"),
                        key: "level",
                        render: (_: unknown, u: AuthUser) =>
                            isSelf(u.username) || !users.length ? (
                                <Tag>{groupLabel(u)}</Tag>
                            ) : (
                                <Select
                                    size="small"
                                    value={groupValue(u)}
                                    style={{ minWidth: 110 }}
                                    onChange={(value) =>
                                        void updateUser(u.username, groupChange(value))
                                    }
                                    options={groupOptions}
                                    aria-label={t("settings.webAuth.level")}
                                />
                            ),
                    },
                    ...(acl.admin
                        ? [
                              {
                                  title: t("settings.webAuth.deny"),
                                  key: "deny",
                                  render: (_: unknown, u: AuthUser) =>
                                      u.level === "admin" ? null : (
                                          <UserDenyButton
                                              username={u.username}
                                              value={u.deny ?? ""}
                                              tree={rightsTree}
                                              onSave={(deny) => updateUser(u.username, { deny })}
                                          />
                                      ),
                              },
                          ]
                        : []),
                    {
                        title: t("settings.webAuth.twoFactor.title"),
                        key: "2fa",
                        render: (_: unknown, u: AuthUser) =>
                            u.twoFactor ? (
                                <Tag color="green">{t("settings.webAuth.twoFactor.on")}</Tag>
                            ) : (
                                <Tag color={u.require2fa || require2faAll ? "red" : "default"}>
                                    {u.require2fa || require2faAll
                                        ? t("settings.webAuth.twoFactor.pending")
                                        : t("settings.webAuth.twoFactor.off")}
                                </Tag>
                            ),
                    },
                    {
                        title: (
                            <Tooltip title={t("settings.webAuth.require2faHint")}>
                                {t("settings.webAuth.require2fa")}
                            </Tooltip>
                        ),
                        key: "require2fa",
                        render: (_: unknown, u: AuthUser) => (
                            <Switch
                                size="small"
                                checked={u.require2fa}
                                onChange={(checked) =>
                                    void updateUser(u.username, { require2fa: checked })
                                }
                                aria-label={t("settings.webAuth.require2fa")}
                            />
                        ),
                    },
                    {
                        title: (
                            <Tooltip title={t("settings.webAuth.lanOnlyHint")}>
                                {t("settings.webAuth.lanOnly")}
                            </Tooltip>
                        ),
                        key: "lanOnly",
                        render: (_: unknown, u: AuthUser) => (
                            <Switch
                                size="small"
                                checked={u.lanOnly}
                                onChange={(checked) =>
                                    void updateUser(u.username, { lanOnly: checked })
                                }
                                aria-label={t("settings.webAuth.lanOnly")}
                            />
                        ),
                    },
                    {
                        title: t("settings.webAuth.lastLogin"),
                        key: "lastLogin",
                        render: (_: unknown, u: AuthUser) =>
                            formatTime(u.lastLogin, t("settings.webAuth.never")),
                    },
                    {
                        title: "",
                        key: "actions",
                        render: (_: unknown, u: AuthUser) => (
                            <Flex justify="flex-end" gap={0}>
                                {!isSelf(u.username) ? (
                                    <Tooltip
                                        title={t("settings.webAuth.changePasswordFor", {
                                            username: u.username,
                                        })}
                                    >
                                        <Button
                                            type="text"
                                            icon={<EditOutlined />}
                                            onClick={() => togglePasswordRow(u.username)}
                                            aria-label={t("settings.webAuth.changePasswordFor", {
                                                username: u.username,
                                            })}
                                            style={{ minHeight: 44, minWidth: 44 }}
                                        />
                                    </Tooltip>
                                ) : null}
                                {u.twoFactor ? (
                                    <Tooltip title={t("settings.webAuth.twoFactor.reset")}>
                                        <Button
                                            type="text"
                                            icon={<StopOutlined />}
                                            onClick={() => setUserToReset(u.username)}
                                            aria-label={t("settings.webAuth.twoFactor.reset")}
                                            style={{ minHeight: 44, minWidth: 44 }}
                                        />
                                    </Tooltip>
                                ) : null}
                                {loggedIn ? (
                                    <Tooltip title={t("settings.webAuth.sessions.revokeUser")}>
                                        <Button
                                            type="text"
                                            icon={<LogoutOutlined />}
                                            onClick={() =>
                                                void updateUser(u.username, {
                                                    revokeSessions: true,
                                                })
                                            }
                                            aria-label={t("settings.webAuth.sessions.revokeUser")}
                                            style={{ minHeight: 44, minWidth: 44 }}
                                        />
                                    </Tooltip>
                                ) : null}
                                <Tooltip title={t("settings.webAuth.deleteUser")}>
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => setUserToDelete(u.username)}
                                        aria-label={t("settings.webAuth.deleteUser")}
                                        style={{ minHeight: 44, minWidth: 44 }}
                                    />
                                </Tooltip>
                            </Flex>
                        ),
                    },
                ]}
                style={{ marginBottom: 24 }}
            />
            {acl.admin && users.length > 0 ? (
                <UserOwned usernames={users.map((u) => u.username)} />
            ) : null}

            <Title level={4}>{t("settings.webAuth.addUser")}</Title>
            <Form
                form={createForm}
                layout="vertical"
                onFinish={(v) => void handleCreate(v)}
                style={{ maxWidth: 420, marginBottom: 24 }}
            >
                <Form.Item
                    name="username"
                    label={t("auth.username")}
                    rules={[
                        { required: true, message: t("auth.usernameRequired") },
                        {
                            pattern: /^[A-Za-z0-9._-]{1,32}$/,
                            message: t("settings.webAuth.errors.invalid_user"),
                        },
                    ]}
                >
                    <Input autoComplete="off" style={{ minHeight: 44 }} />
                </Form.Item>
                <Form.Item
                    name="password"
                    label={t("auth.password")}
                    rules={[
                        { required: true, message: t("auth.passwordRequired") },
                        {
                            min: minLength,
                            message: t("auth.passwordMinLength", { count: minLength }),
                        },
                    ]}
                >
                    <Input.Password autoComplete="new-password" style={{ minHeight: 44 }} />
                </Form.Item>
                <Form.Item
                    name="level"
                    label={t("settings.webAuth.level")}
                    initialValue={acl.admin ? "user" : acl.level}
                >
                    <Select options={groupOptions} style={{ minHeight: 44 }} />
                </Form.Item>
                <Form.Item name="require2fa" valuePropName="checked" style={{ marginBottom: 4 }}>
                    <Checkbox>{t("settings.webAuth.require2fa")}</Checkbox>
                </Form.Item>
                <Form.Item
                    name="mustChangePassword"
                    valuePropName="checked"
                    style={{ marginBottom: 4 }}
                >
                    <Checkbox>{t("settings.webAuth.mustChangePassword")}</Checkbox>
                </Form.Item>
                <Form.Item name="lanOnly" valuePropName="checked">
                    <Checkbox>{t("settings.webAuth.lanOnlyHint")}</Checkbox>
                </Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    disabled={maxUsers > 0 && users.length >= maxUsers}
                    style={{ minHeight: 44 }}
                >
                    {t("settings.webAuth.addUser")}
                </Button>
            </Form>

            {acl.admin ? (
                <UserGroups
                    catalog={rights.catalog}
                    tree={rights.tree}
                    tonieTree={rights.tonieTree}
                    loadError={rights.error}
                    reload={() => {
                        rights.reload();
                        void load();
                    }}
                />
            ) : null}
            {loggedIn && acl.admin ? <SecurityEvents /> : null}

            <Title level={4}>{t("settings.webAuth.access.title")}</Title>
            <Paragraph>
                {t("settings.webAuth.access.hint")}{" "}
                <Link to="/settings">{t("settings.webAuth.access.link")}</Link>
            </Paragraph>
            {client?.forwardedForIgnored ? (
                <Alert
                    type="warning"
                    showIcon
                    title={t("settings.webAuth.access.untrustedProxy", { ip: client.ip })}
                    style={{ marginBottom: 12, maxWidth: 720 }}
                />
            ) : null}
            {client ? (
                <Descriptions
                    size="small"
                    column={1}
                    bordered
                    style={{ maxWidth: 520, marginBottom: 24 }}
                >
                    <Descriptions.Item label={t("settings.webAuth.access.ip")}>
                        {client.ip}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("settings.webAuth.access.network")}>
                        {client.lan
                            ? t("settings.webAuth.access.lan")
                            : t("settings.webAuth.access.remote")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("settings.webAuth.access.connection")}>
                        {client.secure ? "HTTPS" : "HTTP"}
                        {client.viaTrustedProxy
                            ? ` · ${t("settings.webAuth.access.viaProxy")}`
                            : ""}
                    </Descriptions.Item>
                </Descriptions>
            ) : null}

            <ConfirmationDialog
                title={
                    lastUser
                        ? t("settings.webAuth.deleteLastTitle")
                        : t("settings.webAuth.deleteTitle")
                }
                okText={t("settings.webAuth.deleteUser")}
                cancelText={t("common.cancel")}
                content={
                    lastUser
                        ? t("settings.webAuth.deleteLastContent", { username: userToDelete || "" })
                        : t("settings.webAuth.deleteContent", { username: userToDelete || "" })
                }
                contentHint={lastUser ? t("settings.webAuth.deleteLastHint") : undefined}
                open={!!userToDelete}
                handleOk={confirmDelete}
                handleCancel={() => setUserToDelete(null)}
            />
            <ConfirmationDialog
                title={t("settings.webAuth.twoFactor.reset")}
                okText={t("settings.webAuth.twoFactor.reset")}
                cancelText={t("common.cancel")}
                content={t("settings.webAuth.twoFactor.resetContent", {
                    username: userToReset || "",
                })}
                open={!!userToReset}
                handleOk={confirmReset}
                handleCancel={() => setUserToReset(null)}
            />
        </>
    );
};
