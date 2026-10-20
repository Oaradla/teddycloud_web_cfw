import { useEffect, useMemo, useState, type Key } from "react";
import { useTranslation } from "react-i18next";
import { Button, Flex, Input, Tag, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";

import {
    leaves,
    listToChecked,
    checkedToList,
    type RightsNode,
} from "../../../utils/auth/rightsTree";

const { Text } = Typography;

type Props = {
    tree: RightsNode;
    value?: string;
    onChange?: (value: string) => void;
    height?: number;
    /** offer the text form for patterns the tree can not show */
    textForm?: boolean;
};

/** Rights as a tree of check boxes; the text form stays reachable for special patterns. */
export const RightsTreeEditor = ({
    tree,
    value = "",
    onChange,
    height = 320,
    textForm = true,
}: Props) => {
    const { t } = useTranslation();
    const [asText, setAsText] = useState(false);
    const [text, setText] = useState(value);
    const [filter, setFilter] = useState("");

    useEffect(() => setText(value), [value]);

    const { checked, extra } = useMemo(() => listToChecked(tree, value), [tree, value]);
    const leafKeys = useMemo(() => new Set(leaves(tree).map((l) => l.key)), [tree]);

    const title = (node: RightsNode): string => {
        switch (node.kind) {
            case "all":
                return t("settings.webAuth.tree.all");
            case "scope":
                return t(`settings.webAuth.tree.scopes.${node.label}`, node.label);
            case "settings":
                return t("settings.webAuth.tree.settings");
            case "group":
                return node.label;
            case "setting":
                return node.label;
            default:
                return t(`sharing.rights.${node.pattern}`, node.pattern);
        }
    };

    const needle = filter.trim().toLowerCase();
    const matches = (node: RightsNode): boolean =>
        !needle ||
        title(node).toLowerCase().includes(needle) ||
        node.pattern.toLowerCase().includes(needle) ||
        (node.children ?? []).some(matches);

    const toData = (node: RightsNode): DataNode => ({
        key: node.key,
        title:
            node.kind === "setting" ? (
                <span>
                    {title(node)}{" "}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {node.pattern.slice("box.setting:".length)}
                    </Text>
                </span>
            ) : (
                title(node)
            ),
        children: node.children?.filter(matches).map(toData),
    });

    const data = useMemo(() => [toData(tree)], [tree, needle, t]);
    const expanded = useMemo(() => {
        /* closed at first: only the scopes show */
        if (!needle) {
            return [tree.key];
        }
        const keys: string[] = [];
        const walk = (n: RightsNode) => {
            if (n.children && matches(n)) {
                keys.push(n.key);
                n.children.forEach(walk);
            }
        };
        walk(tree);
        return keys;
    }, [tree, needle]);
    const [openKeys, setOpenKeys] = useState<Key[]>(expanded);
    useEffect(() => setOpenKeys(expanded), [expanded]);

    const emit = (keys: string[]) => onChange?.(checkedToList(tree, keys, extra));

    return (
        <Flex vertical gap={8}>
            {asText ? (
                <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={() => text !== value && onChange?.(text)}
                    placeholder="box.view, box.setting:cloud.*"
                />
            ) : (
                <>
                    <Input.Search
                        allowClear
                        size="small"
                        placeholder={t("settings.webAuth.tree.search")}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ maxWidth: 280 }}
                    />
                    <div
                        style={{
                            border: "1px solid rgba(128,128,128,0.25)",
                            borderRadius: 6,
                            padding: 4,
                        }}
                    >
                        <Tree
                            checkable
                            selectable={false}
                            height={height}
                            treeData={data}
                            checkedKeys={checked}
                            expandedKeys={openKeys}
                            onExpand={(keys) => setOpenKeys(keys)}
                            onCheck={(keys) => {
                                const list = (Array.isArray(keys) ? keys : keys.checked).map(
                                    String,
                                );
                                /* while filtering, hidden leaves keep their state */
                                const visible = new Set<string>();
                                const collect = (n: RightsNode) => {
                                    if (!matches(n)) return;
                                    if (!n.children) visible.add(n.key);
                                    n.children?.forEach(collect);
                                };
                                collect(tree);
                                emit([
                                    ...checked.filter((k) => !visible.has(k)),
                                    ...list.filter((k) => leafKeys.has(k)),
                                ]);
                            }}
                        />
                    </div>
                </>
            )}
            <Flex gap={8} wrap="wrap" align="center">
                {extra.length > 0 && !asText ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("settings.webAuth.tree.extra")}{" "}
                        {extra.map((e) => (
                            <Tag key={e}>{e}</Tag>
                        ))}
                    </Text>
                ) : null}
                {textForm ? (
                    <Button
                        type="link"
                        size="small"
                        onClick={() => setAsText((v) => !v)}
                        style={{ padding: 0 }}
                    >
                        {asText
                            ? t("settings.webAuth.tree.asTree")
                            : t("settings.webAuth.tree.asText")}
                    </Button>
                ) : null}
            </Flex>
        </Flex>
    );
};
