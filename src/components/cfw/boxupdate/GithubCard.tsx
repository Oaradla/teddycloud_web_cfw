import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Button,
    Card,
    Input,
    InputNumber,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { CloudDownloadOutlined, ReloadOutlined } from "@ant-design/icons";

import { cfwApi, CfwFirmwareResponse, CfwGithubRelease, formatTime } from "../../../api/cfwApi";
import { CHANNEL_COLOR } from "./channels";
import { useNotify } from "./useNotify";

const { Text } = Typography;

/** the newest releases; the older ones are a link away on GitHub */
const SHOWN_RELEASES = 2;

interface GithubCardProps {
    github: CfwFirmwareResponse["github"] | undefined;
    interval: number;
    onChanged: () => Promise<void>;
}

/** the GitHub repository with the box firmware: automatic download per channel, releases to download */
export const GithubCard: React.FC<GithubCardProps> = ({ github, interval, onChanged }) => {
    const { t } = useTranslation();
    const notify = useNotify();
    const [repo, setRepo] = useState("");
    const [hours, setHours] = useState(interval);
    const [busy, setBusy] = useState(false);

    useEffect(() => setRepo(github?.repo ?? ""), [github?.repo]);
    useEffect(() => setHours(interval), [interval]);

    const setSetting = async (name: string, value: string | number) => {
        const result = await cfwApi.setSetting(name, value);
        if (!result.ok) notify(result, "", t("cfw.saveError"));
        await onChanged();
    };

    const run = async (
        action: () => Promise<{ ok: boolean; message: string }>,
        success: string,
        failure: string,
    ) => {
        setBusy(true);
        try {
            notify(await action(), success, failure);
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const columns: ColumnsType<CfwGithubRelease> = [
        {
            title: t("cfw.update.release"),
            key: "tag",
            render: (_, release) =>
                `${release.tag}${release.name && release.name !== release.tag ? " · " + release.name : ""}`,
        },
        {
            title: t("cfw.update.channelLabel"),
            key: "channel",
            render: (_, release) => (
                <Tag color={CHANNEL_COLOR[release.channel]}>
                    {t(`cfw.channel.${release.channel}`)}
                </Tag>
            ),
        },
        {
            title: t("cfw.update.published"),
            key: "published",
            render: (_, release) =>
                release.published ? new Date(release.published).toLocaleString() : "-",
        },
        {
            key: "download",
            render: (_, release) =>
                release.downloaded ? (
                    <Tag color="green">{t("cfw.update.inLibrary")}</Tag>
                ) : (
                    <Button
                        icon={<CloudDownloadOutlined />}
                        disabled={!release.hasImage || busy}
                        onClick={() =>
                            run(
                                () => cfwApi.downloadGithub(release.tag),
                                t("cfw.update.downloaded"),
                                t("cfw.update.downloadFailed"),
                            )
                        }
                    >
                        {release.hasImage ? t("cfw.update.download") : t("cfw.update.noImage")}
                    </Button>
                ),
        },
    ];

    return (
        <Card title={t("cfw.update.github")}>
            <Space orientation="vertical" style={{ width: "100%" }}>
                <Space wrap>
                    <Text>{t("cfw.update.githubRepo")}</Text>
                    <Input
                        style={{ width: 320 }}
                        placeholder={t("cfw.update.githubRepoPlaceholder")}
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        onBlur={() =>
                            repo.trim() !== (github?.repo ?? "") &&
                            setSetting("cfw.firmware.github_repo", repo.trim())
                        }
                    />
                </Space>
                <Space wrap>
                    <Text>{t("cfw.update.githubAuto")}</Text>
                    <Select
                        style={{ width: 280 }}
                        value={github?.autoDownload ?? 0}
                        onChange={(value) => setSetting("cfw.firmware.github_download", value)}
                        options={[0, 1, 2, 3].map((value) => ({
                            value,
                            label: t(`cfw.update.githubAutoValues.${value}`),
                        }))}
                    />
                    <Text>{t("cfw.update.githubInterval")}</Text>
                    <InputNumber
                        min={1}
                        max={720}
                        value={hours}
                        onChange={(value) => setHours(value ?? interval)}
                        onBlur={() =>
                            hours !== interval && setSetting("cfw.firmware.github_interval", hours)
                        }
                        suffix="h"
                    />
                </Space>
                <Space wrap>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={busy}
                        disabled={!github?.repo}
                        onClick={() =>
                            run(
                                cfwApi.checkGithub,
                                t("cfw.update.githubChecked"),
                                t("cfw.update.githubFailed"),
                            )
                        }
                    >
                        {t("cfw.update.githubCheck")}
                    </Button>
                    {github?.lastCheck ? (
                        <Text type="secondary">
                            {t("cfw.update.githubLastCheck", {
                                time: formatTime(github.lastCheck),
                                message: github.message,
                            })}
                        </Text>
                    ) : null}
                </Space>
                {!github?.repo && (
                    <Alert type="info" showIcon title={t("cfw.update.githubNoRepo")} />
                )}
                {github && github.releases.length > 0 && (
                    <Table
                        rowKey="tag"
                        size="small"
                        columns={columns}
                        dataSource={github.releases.slice(0, SHOWN_RELEASES)}
                        pagination={false}
                        scroll={{ x: true }}
                    />
                )}
                {github && github.releases.length > SHOWN_RELEASES && (
                    <a
                        href={`https://github.com/${github.repo}/releases`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("cfw.update.olderReleases", {
                            n: github.releases.length - SHOWN_RELEASES,
                        })}
                    </a>
                )}
            </Space>
        </Card>
    );
};
