import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Flex, Form, Input, Select, Spin, Tabs, Typography } from "antd";

import ConfirmationDialog from "../../common/modals/ConfirmationModal";
import {
    deleteAclGroup,
    saveAclGroup,
    saveAclLevels,
    type AclCatalog,
    type AclGroup,
} from "../../../utils/auth/aclApi";
import type { RightsNode } from "../../../utils/auth/rightsTree";
import { authErrorText } from "./authFormat";
import { RightsTreeEditor } from "./RightsTreeEditor";

const { Title, Paragraph } = Typography;

type Draft = AclGroup & { key: string; dirty?: boolean };

type Props = {
    catalog: AclCatalog | null;
    tree: RightsNode | null;
    tonieTree: RightsNode | null;
    loadError: unknown;
    reload: () => void;
};

/**
 * The groups of users and what they may have at most (admins only): the built-in
 * groups of the levels "user" and "guest" (child) and own groups of either kind.
 */
export const UserGroups = ({ catalog, tree, tonieTree, loadError, reload }: Props) => {
    const { t } = useTranslation();
    const [levels, setLevels] = useState({ user: "*", guest: "", unassignedTonie: "" });
    const [groups, setGroups] = useState<Draft[]>([]);
    const [active, setActive] = useState("user");
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Draft | null>(null);

    useEffect(() => {
        if (!catalog) return;
        setLevels({
            user: catalog.levelLimits.user ?? "*",
            guest: catalog.levelLimits.guest ?? "",
            unassignedTonie: catalog.unassigned.tonie ?? "",
        });
        setGroups((catalog.groups ?? []).map((g) => ({ ...g, key: `g:${g.id}` })));
    }, [catalog]);

    useEffect(() => {
        if (loadError) setError(authErrorText(t, loadError));
    }, [loadError]);

    const changeLevel = (key: keyof typeof levels) => (value: string) => {
        setSaved(false);
        setLevels((l) => ({ ...l, [key]: value }));
    };
    const changeGroup = (key: string, change: Partial<AclGroup>) => {
        setSaved(false);
        setGroups((list) =>
            list.map((g) => (g.key === key ? { ...g, ...change, dirty: true } : g)),
        );
    };

    const addGroup = () => {
        const key = `new:${Date.now()}`;
        setGroups((list) => [
            ...list,
            {
                key,
                id: "",
                name: t("settings.webAuth.levels.newGroup"),
                base: "guest",
                rights: levels.guest,
                dirty: true,
            },
        ]);
        setActive(key);
    };

    const removeGroup = async (group: Draft) => {
        setError(null);
        try {
            if (group.id) {
                await deleteAclGroup(group.id);
            }
            setGroups((list) => list.filter((g) => g.key !== group.key));
            setActive("user");
            if (group.id) reload();
        } catch (err) {
            setError(authErrorText(t, err));
        }
    };

    const save = async () => {
        setError(null);
        setSaved(false);
        setSaving(true);
        try {
            await saveAclLevels(levels);
            for (const g of groups.filter((g) => g.dirty)) {
                await saveAclGroup({
                    ...(g.id ? { id: g.id } : {}),
                    name: g.name.trim(),
                    base: g.base,
                    rights: g.rights,
                });
            }
            setSaved(true);
            reload();
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setSaving(false);
        }
    };

    const limitTree = (value: string, onChange: (v: string) => void) =>
        tree ? (
            <>
                <Paragraph strong style={{ marginBottom: 4 }}>
                    {t("settings.webAuth.levels.allowTitle")}
                </Paragraph>
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                    {t("settings.webAuth.levels.allowHint")}
                </Paragraph>
                <div style={{ maxWidth: 640 }}>
                    <RightsTreeEditor tree={tree} value={value} onChange={onChange} />
                </div>
            </>
        ) : null;

    const kindOptions = (["user", "guest"] as const).map((k) => ({
        value: k,
        label: t(`sharing.levels.${k}`),
    }));

    const items = [
        {
            key: "user",
            label: t("sharing.levels.user"),
            closable: false,
            children: (
                <>
                    <Paragraph type="secondary">
                        {t("settings.webAuth.levels.kindHints.user")}
                    </Paragraph>
                    {limitTree(levels.user, changeLevel("user"))}
                </>
            ),
        },
        {
            key: "guest",
            label: t("sharing.levels.guest"),
            closable: false,
            children: (
                <>
                    <Paragraph type="secondary">
                        {t("settings.webAuth.levels.kindHints.guest")}
                    </Paragraph>
                    {limitTree(levels.guest, changeLevel("guest"))}
                </>
            ),
        },
        ...groups.map((g) => ({
            key: g.key,
            label: g.name || "…",
            closable: true,
            children: (
                <>
                    <Form layout="vertical" style={{ maxWidth: 420 }}>
                        <Form.Item label={t("settings.webAuth.levels.name")}>
                            <Input
                                value={g.name}
                                maxLength={32}
                                onChange={(e) => changeGroup(g.key, { name: e.target.value })}
                                style={{ minHeight: 44 }}
                            />
                        </Form.Item>
                        <Form.Item
                            label={t("settings.webAuth.levels.kind")}
                            extra={t(`settings.webAuth.levels.kindHints.${g.base}`)}
                        >
                            <Select
                                value={g.base}
                                options={kindOptions}
                                onChange={(base) => changeGroup(g.key, { base })}
                            />
                        </Form.Item>
                    </Form>
                    {limitTree(g.rights, (rights) => changeGroup(g.key, { rights }))}
                </>
            ),
        })),
    ];

    return (
        <Card style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginTop: 0 }}>
                {t("settings.webAuth.levels.title")}
            </Title>
            <Paragraph>{t("settings.webAuth.levels.hint")}</Paragraph>
            {error ? (
                <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />
            ) : null}
            {saved ? (
                <Alert
                    type="success"
                    showIcon
                    title={t("settings.webAuth.levels.saved")}
                    style={{ marginBottom: 12 }}
                />
            ) : null}
            {!catalog || !tree ? (
                loadError ? null : (
                    <Spin />
                )
            ) : (
                <Flex vertical gap={16}>
                    <Tabs
                        type="editable-card"
                        activeKey={active}
                        onChange={setActive}
                        addIcon={
                            <span title={t("settings.webAuth.levels.addGroup")}>
                                + {t("settings.webAuth.levels.addGroup")}
                            </span>
                        }
                        onEdit={(key, action) => {
                            if (action === "add") {
                                addGroup();
                            } else {
                                const group = groups.find((g) => g.key === key);
                                if (group) setToDelete(group);
                            }
                        }}
                        items={items}
                    />
                    {/* not a group: what everyone may do with tonies nobody owns */}
                    <div>
                        <Title level={5} style={{ marginTop: 0 }}>
                            {t("settings.webAuth.levels.unassignedTonie")}
                        </Title>
                        <Paragraph type="secondary">
                            {t("settings.webAuth.levels.unassignedHint")}
                        </Paragraph>
                        {tonieTree ? (
                            <div style={{ maxWidth: 480 }}>
                                <RightsTreeEditor
                                    tree={tonieTree}
                                    height={200}
                                    value={levels.unassignedTonie}
                                    onChange={changeLevel("unassignedTonie")}
                                />
                            </div>
                        ) : null}
                    </div>
                    <Button
                        type="primary"
                        loading={saving}
                        onClick={() => void save()}
                        style={{ minHeight: 44, alignSelf: "flex-start" }}
                    >
                        {t("settings.webAuth.levels.save")}
                    </Button>
                </Flex>
            )}
            <ConfirmationDialog
                title={t("settings.webAuth.levels.deleteTitle")}
                okText={t("settings.webAuth.levels.delete")}
                cancelText={t("common.cancel")}
                content={t("settings.webAuth.levels.deleteContent", { name: toDelete?.name ?? "" })}
                open={!!toDelete}
                handleOk={() => {
                    const group = toDelete;
                    setToDelete(null);
                    if (group) void removeGroup(group);
                }}
                handleCancel={() => setToDelete(null)}
            />
        </Card>
    );
};
