import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Form, Radio, Typography } from "antd";

import { cfwApi, CfwEvent, CfwProfile, CfwResult, CfwTag, formatTime } from "../../api/cfwApi";
import LoadingSpinner from "../common/elements/LoadingSpinner";
import { CfwEventForm } from "./CfwEventForm";
import { cfwMessage } from "./cfwMessages";
import { CfwProfileForm } from "./CfwProfileForm";

const { Text } = Typography;

export interface CfwTagSettingsHandle {
    save: () => Promise<CfwResult>;
}

interface CfwTagSettingsProps {
    ruid: string;
    onDirtyChange?: (dirty: boolean) => void;
    /** the use chosen (also before saving), e.g. to hide the source of an event tag */
    onKindChange?: (kind: CfwTag["kind"]) => void;
}

const EMPTY_PROFILE: CfwProfile = {
    resume: null,
    shuffle: null,
    sleepMinutes: null,
    speakerLimit: null,
    headphoneLimit: null,
    ledLevel: null,
    slapLock: null,
    tiltLock: null,
    volumeLock: null,
};

const EMPTY_EVENT: CfwEvent = { tones: true, actions: [{ action: 1, mode: 0, value: 0 }] };

/** what is saved for the chosen use */
const tagSettings = (
    kind: CfwTag["kind"],
    profile: CfwProfile,
    event: CfwEvent,
): Omit<CfwTag, "ruid"> =>
    kind === "profile" ? { kind, profile } : kind === "event" ? { kind, event } : { kind: "none" };

/** the settings of the custom firmware for one tag: a profile for a figure, or an event tag */
export const CfwTagSettings = forwardRef<CfwTagSettingsHandle, CfwTagSettingsProps>(
    ({ ruid, onDirtyChange, onKindChange }, ref) => {
        const { t } = useTranslation();
        const [loaded, setLoaded] = useState<CfwTag | null>(null);
        const [error, setError] = useState<string | null>(null);
        const [kind, setKind] = useState<CfwTag["kind"]>("none");
        const [profile, setProfile] = useState<CfwProfile>(EMPTY_PROFILE);
        const [event, setEvent] = useState<CfwEvent>(EMPTY_EVENT);

        const show = (tag: CfwTag) => {
            setLoaded(tag);
            setKind(tag.kind);
            setProfile({ ...EMPTY_PROFILE, ...tag.profile });
            setEvent(tag.event?.actions.length ? tag.event : EMPTY_EVENT);
        };

        useEffect(() => {
            let current = true;
            setLoaded(null);
            setError(null);
            cfwApi
                .tag(ruid)
                .then((tag) => current && show(tag))
                .catch((e) => current && setError(String(e)));
            return () => {
                current = false;
            };
        }, [ruid]);

        const dirty = useMemo(
            () =>
                loaded !== null &&
                JSON.stringify(
                    tagSettings(
                        loaded.kind,
                        { ...EMPTY_PROFILE, ...loaded.profile },
                        loaded.event ?? EMPTY_EVENT,
                    ),
                ) !== JSON.stringify(tagSettings(kind, profile, event)),
            [loaded, kind, profile, event],
        );

        useEffect(() => onDirtyChange?.(dirty), [dirty]);
        useEffect(() => onKindChange?.(kind), [kind]);

        useImperativeHandle(ref, () => ({
            save: async () => {
                const saved = tagSettings(kind, profile, event);
                const result = await cfwApi.setTag(ruid, saved);
                if (result.ok) {
                    try {
                        show(await cfwApi.tag(ruid));
                    } catch {
                        // saved, only reading it back failed: what was saved is the new state
                        show({ ruid, origin: "server", ...saved });
                    }
                }
                return { ...result, message: cfwMessage(t, result.message) };
            },
        }));

        if (error)
            return <Alert type="error" showIcon title={t("cfw.loadError")} description={error} />;
        if (loaded === null) return <LoadingSpinner />;

        return (
            <>
                <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                    {t("cfw.tagIntro")}
                </Text>
                <Form.Item label={t("cfw.kind")} style={{ marginBottom: 16 }}>
                    <Radio.Group value={kind} onChange={(e) => setKind(e.target.value)}>
                        <Radio.Button value="none">{t("cfw.kindNone")}</Radio.Button>
                        <Radio.Button value="profile">{t("cfw.kindProfile")}</Radio.Button>
                        <Radio.Button value="event">{t("cfw.kindEvent")}</Radio.Button>
                    </Radio.Group>
                </Form.Item>
                {kind === "profile" && <CfwProfileForm profile={profile} onChange={setProfile} />}
                {kind === "event" && (
                    <>
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 12 }}
                            title={t("cfw.event.intro")}
                        />
                        <CfwEventForm event={event} onChange={setEvent} />
                    </>
                )}
                {loaded.kind !== "none" && loaded.timestamp ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("cfw.lastChange", {
                            time: formatTime(loaded.timestamp),
                            origin: t(`cfw.origin.${loaded.origin || "unknown"}`),
                        })}
                    </Text>
                ) : null}
            </>
        );
    },
);

CfwTagSettings.displayName = "CfwTagSettings";
