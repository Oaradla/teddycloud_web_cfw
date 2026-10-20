import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, Typography } from "antd";
import { SafetyOutlined } from "@ant-design/icons";

import {
    checkedToList,
    leaves,
    listToChecked,
    type RightsNode,
} from "../../../utils/auth/rightsTree";
import { RightsTreeEditor } from "./RightsTreeEditor";

const { Paragraph } = Typography;

type Props = {
    username: string;
    /** what the admin took from the user (stored as a deny list) */
    value: string;
    tree: RightsNode | null;
    onSave: (deny: string) => Promise<void> | void;
};

/** What one user may do within the limit of the group, picked as allowed rights. */
export const UserDenyButton = ({ username, value, tree, onSave }: Props) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setDraft(value);
    }, [open, value]);

    const all = useMemo(() => (tree ? leaves(tree).map((l) => l.key) : []), [tree]);
    const denied = (list: string) =>
        tree ? listToChecked(tree, list) : { checked: [], extra: [] };

    /* the tree shows what stays allowed; stored is what is taken away */
    const allowed = useMemo(() => {
        if (!tree) return "";
        const taken = new Set(denied(draft).checked);
        return checkedToList(
            tree,
            all.filter((k) => !taken.has(k)),
        );
    }, [tree, draft, all]);
    const setAllowed = (list: string) => {
        if (!tree) return;
        const keep = new Set(listToChecked(tree, list).checked);
        setDraft(
            checkedToList(
                tree,
                all.filter((k) => !keep.has(k)),
                denied(draft).extra,
            ),
        );
    };

    const count = tree ? denied(value).checked.length + denied(value).extra.length : value ? 1 : 0;

    return (
        <>
            <Button
                size="small"
                icon={<SafetyOutlined />}
                disabled={!tree}
                onClick={() => setOpen(true)}
            >
                {count === 0
                    ? t("settings.webAuth.denyNone")
                    : t("settings.webAuth.denyCount", { count })}
            </Button>
            <Modal
                open={open}
                title={t("settings.webAuth.denyTitle", { username })}
                okText={t("settings.webAuth.levels.save")}
                cancelText={t("common.cancel")}
                confirmLoading={saving}
                onCancel={() => setOpen(false)}
                onOk={async () => {
                    setSaving(true);
                    try {
                        await onSave(draft);
                        setOpen(false);
                    } finally {
                        setSaving(false);
                    }
                }}
                width={640}
            >
                <Paragraph type="secondary">
                    {t("settings.webAuth.denyHint", { username })}
                </Paragraph>
                {tree ? (
                    <RightsTreeEditor
                        tree={tree}
                        value={allowed}
                        onChange={setAllowed}
                        textForm={false}
                    />
                ) : null}
            </Modal>
        </>
    );
};
