import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, List, Typography } from "antd";

import { cfwApi, CfwPosition, CfwResume, formatTime } from "../../api/cfwApi";
import { useTeddyCloud } from "../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../types/teddyCloudNotificationTypes";
import { cfwMessage } from "./cfwMessages";

const { Text } = Typography;

const minutes = (seconds: number) =>
    seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;

interface CfwResumeInfoProps {
    ruid: string;
    resume: CfwResume;
    onChosen: () => void;
}

/** where the figure was heard last and, for global resume, its position or the conflict to decide */
export const CfwResumeInfo = ({ ruid, resume, onChosen }: CfwResumeInfoProps) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const [names, setNames] = useState<Record<string, string>>({});
    const [choosing, setChoosing] = useState(false);

    useEffect(() => {
        cfwApi
            .boxes()
            .then((boxes) =>
                setNames(Object.fromEntries(boxes.map((b) => [b.id, b.boxName || b.commonName]))),
            )
            .catch(() => setNames({}));
    }, []);

    const box = (id: string) => names[id] || id;
    const fail = (message: string) =>
        addNotification(
            NotificationTypeEnum.Error,
            t("cfw.resume.title"),
            message,
            t("cfw.resume.title"),
        );
    /** the server takes the branch by its index: only while the list shown is still the current one */
    const choose = async (branch: number, shown: CfwPosition) => {
        setChoosing(true);
        try {
            const now = (await cfwApi.tag(ruid)).resume;
            if (!now?.conflict || JSON.stringify(now.branches[branch]) !== JSON.stringify(shown)) {
                fail(t("cfw.resume.changed"));
                return;
            }
            const result = await cfwApi.chooseResume(ruid, branch);
            if (result.ok) {
                addNotification(
                    NotificationTypeEnum.Success,
                    t("cfw.resume.chosen"),
                    "",
                    t("cfw.resume.title"),
                );
            } else {
                fail(cfwMessage(t, result.message));
            }
        } catch (e) {
            fail(String(e));
        } finally {
            setChoosing(false);
            onChosen();
        }
    };
    const branchText = (p: CfwPosition) =>
        t("cfw.resume.branch", {
            box: box(p.box),
            listened: minutes(p.listened),
            time: formatTime(p.time),
        });

    return (
        <div style={{ marginBottom: 12 }}>
            <Text strong style={{ display: "block" }}>
                {t(resume.global || resume.conflict ? "cfw.resume.title" : "cfw.resume.titleLast")}
            </Text>
            {resume.onBox && (
                <Text type="secondary" style={{ display: "block" }}>
                    {t("cfw.resume.playing", { box: box(resume.onBox) })}
                </Text>
            )}
            {resume.last.box && (
                <Text type="secondary" style={{ display: "block" }}>
                    {t("cfw.resume.last", {
                        box: box(resume.last.box),
                        time: formatTime(resume.last.time),
                    })}
                </Text>
            )}
            {resume.global && resume.current && !resume.conflict && (
                <Text type="secondary" style={{ display: "block" }}>
                    {t("cfw.resume.current", {
                        box: box(resume.current.box),
                        listened: minutes(resume.current.listened),
                    })}
                </Text>
            )}
            {resume.conflict && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    title={t("cfw.resume.conflict")}
                    description={
                        <List
                            size="small"
                            dataSource={resume.branches}
                            renderItem={(p, i) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="choose"
                                            size="small"
                                            disabled={choosing}
                                            onClick={() => choose(i, p)}
                                        >
                                            {t("cfw.resume.choose")}
                                        </Button>,
                                    ]}
                                >
                                    {branchText(p)}
                                </List.Item>
                            )}
                        />
                    }
                />
            )}
        </div>
    );
};
