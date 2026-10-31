import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PictureOutlined } from "@ant-design/icons";
import { Alert, Avatar, Collapse, Flex, Tag, Typography } from "antd";

import { TeddyCloudApi } from "../../../api";
import { defaultAPIConfig } from "../../../config/defaultApiConfig";
import { fetchAclOwned, type AclOwned, type AclOwnedItem } from "../../../utils/auth/aclApi";
import { withBase } from "../../../utils/basePath";

const api = new TeddyCloudApi(defaultAPIConfig());

const { Text } = Typography;

type Names = {
    boxes: Record<string, string>;
    tonies: Record<string, string>;
    /* pictures of boxes, tonies and custom tonies by id */
    pics: Record<"boxes" | "tonies" | "models", Record<string, string>>;
};

const json = <T,>(path: string, fallback: T): Promise<T> =>
    api
        .apiGetTeddyCloudApiRaw(path)
        .then((r) => (r.ok ? r.json() : fallback))
        .catch(() => fallback);

const KINDS = ["boxes", "tonies", "folders", "models", "images"] as const;

/** names of the boxes (by box ID) and tonies (by RUID) and pictures, as far as known */
async function fetchNames(): Promise<Names> {
    const [boxes, tonies, boxModels, models] = await Promise.all([
        api.apiGetTonieboxesIndex().catch(() => []),
        api.apiGetTagIndexMergedAllOverlays(true).catch(() => []),
        json<{ id: string; img_src: string }[]>("/api/tonieboxesJson", []),
        json<{ model: string; pic: string }[]>("/api/toniesCustomJson", []),
    ]);
    const boxPic = Object.fromEntries(boxModels.map((m) => [m.id, m.img_src]));
    return {
        pics: {
            boxes: Object.fromEntries(boxes.map((b) => [b.ID, boxPic[b.boxModel ?? ""]])),
            tonies: Object.fromEntries(
                tonies.map((tonie) => [tonie.ruid.toUpperCase(), tonie.tonieInfo?.picture]),
            ),
            models: Object.fromEntries(models.map((m) => [m.model, m.pic])),
        },
        boxes: Object.fromEntries(boxes.map((b) => [b.ID, b.boxName || b.commonName])),
        tonies: Object.fromEntries(
            tonies.map((tonie) => [
                tonie.ruid.toUpperCase(),
                [tonie.tonieInfo?.series, tonie.tonieInfo?.episode].filter(Boolean).join(" - "),
            ]),
        ),
    };
}

const OwnedByUser = ({ username, names }: { username: string; names: Names }) => {
    const { t } = useTranslation();
    const [owned, setOwned] = useState<AclOwned | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAclOwned(username)
            .then(setOwned)
            .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }, [username]);

    if (error) return <Alert type="error" showIcon title={error} />;
    if (!owned) return null;

    const label = (kind: (typeof KINDS)[number], item: AclOwnedItem) =>
        kind === "boxes" || kind === "tonies" ? names[kind][item.id] || item.id : item.id;
    const pic = (kind: (typeof KINDS)[number], id: string) =>
        kind === "images"
            ? `/custom_img/${id}`
            : kind === "folders"
              ? undefined
              : names.pics[kind][id];
    const kinds = KINDS.filter((kind) => owned[kind]?.length);
    if (kinds.length === 0) return <Text type="secondary">{t("settings.webAuth.owned.none")}</Text>;

    return (
        <Flex vertical gap={12}>
            {kinds.map((kind) => (
                <div key={kind}>
                    <Text strong>{t(`settings.webAuth.owned.${kind}`)}</Text>
                    {owned[kind]!.map((item) => (
                        <Flex key={item.id} gap={8} wrap="wrap" align="center">
                            {kind !== "folders" && (
                                <Avatar
                                    shape="square"
                                    size={32}
                                    icon={<PictureOutlined />}
                                    src={pic(kind, item.id) && withBase(pic(kind, item.id)!)}
                                />
                            )}
                            <span>{label(kind, item)}</span>
                            {item.owner ? (
                                <Tag color="green">{t("settings.webAuth.owned.owner")}</Tag>
                            ) : (
                                <Text type="secondary">
                                    {t("settings.webAuth.owned.shared", {
                                        rights: item.granted ?? "",
                                    })}
                                </Text>
                            )}
                        </Flex>
                    ))}
                </div>
            ))}
        </Flex>
    );
};

/** for admins: what belongs to each user or is shared with them */
export const UserOwned = ({ usernames }: { usernames: string[] }) => {
    const { t } = useTranslation();
    const [names, setNames] = useState<Names | null>(null);

    const loadNames = (keys: string[]) => {
        if (keys.length > 0 && !names) {
            void fetchNames().then(setNames);
        }
    };

    return (
        <Collapse
            onChange={loadNames}
            style={{ marginBottom: 24 }}
            items={usernames.map((username) => ({
                key: username,
                label: t("settings.webAuth.owned.title", { username }),
                children: names ? <OwnedByUser username={username} names={names} /> : null,
            }))}
        />
    );
};
