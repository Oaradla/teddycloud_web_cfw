import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Col, Form, InputNumber, Row, Select, Space, Switch, Typography } from "antd";
import { UndoOutlined } from "@ant-design/icons";

import { TeddyCloudApi } from "../../api";
import { CFW_CAP, CfwProfile, cfwWithoutCapability } from "../../api/cfwApi";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { LED_LEVELS, VOLUME_STEPS } from "./cfwDefinitions";
import { useCfwBoxes } from "./useCfwBoxes";

const { Text } = Typography;

const api = new TeddyCloudApi(defaultAPIConfig());

/** the box settings a missing value of the figure falls back to */
const BOX_SETTING = {
    ledLevel: "toniebox.led",
    speakerLimit: "cfw.box.speaker_limit",
    headphoneLimit: "cfw.box.headphone_limit",
    slapLock: "cfw.box.slap_lock",
    tiltLock: "cfw.box.tilt_lock",
    volumeLock: "cfw.box.volume_lock",
} as const;
type BoxKey = keyof typeof BOX_SETTING;

/** the server's box settings, as booleans and numbers */
const useBoxValues = () => {
    const [values, setValues] = useState<Partial<Record<BoxKey, boolean | number>>>({});
    useEffect(() => {
        let current = true;
        Promise.all(
            (Object.keys(BOX_SETTING) as BoxKey[]).map(async (key) => {
                const response = await api.apiGetTeddyCloudSettingRaw(BOX_SETTING[key]);
                const text = (await response.text()).trim();
                return [key, key.endsWith("Lock") ? text === "true" : Number(text)] as const;
            }),
        )
            .then((entries) => current && setValues(Object.fromEntries(entries)))
            .catch(() => undefined);
        return () => {
            current = false;
        };
    }, []);
    return values;
};

type Field = {
    key: keyof CfwProfile;
    label: string;
    hint?: string;
    /** shown under the input */
    extra?: React.ReactNode;
    span: number;
};

interface CfwProfileFormProps {
    profile: CfwProfile;
    onChange: (profile: CfwProfile) => void;
}

/** the settings of a figure; without a value of its own the figure does what the box does */
export const CfwProfileForm: React.FC<CfwProfileFormProps> = ({ profile, onChange }) => {
    const { t } = useTranslation();
    const { boxes } = useCfwBoxes({ active: profile.globalResume === true });
    const oldBoxes =
        profile.globalResume === true ? cfwWithoutCapability(boxes, CFW_CAP.globalResume) : [];
    const set = (key: keyof CfwProfile, value: boolean | number | null) =>
        onChange({ ...profile, [key]: value });

    const box = useBoxValues();
    const effective = (key: BoxKey) => profile[key] ?? box[key];

    /** a function the box does not know: off is the same as no value */
    const toggle = (key: "resume" | "globalResume" | "shuffle", implied = false) => (
        <Switch
            disabled={implied}
            checked={implied || profile[key] === true}
            onChange={(on) => set(key, on ? true : null)}
        />
    );
    const lockSwitch = (key: "slapLock" | "tiltLock" | "volumeLock") => (
        <Switch checked={effective(key) === true} onChange={(on) => set(key, on)} />
    );
    const numberSelect = (key: BoxKey, options: { value: number; label: string }[]) => (
        <Select
            value={effective(key) as number | undefined}
            onChange={(value) => set(key, Number(value))}
            options={options}
        />
    );
    /** whether the figure has a value of its own, with the way back to the box's */
    const origin = (key: BoxKey) =>
        profile[key] === null ? (
            <Text type="secondary">{t("cfw.profile.fromBox")}</Text>
        ) : (
            <Space size={4}>
                <Text type="warning">{t("cfw.profile.ownValue")}</Text>
                <Button
                    size="small"
                    type="link"
                    icon={<UndoOutlined />}
                    onClick={() => set(key, null)}
                >
                    {t("cfw.profile.useBox")}
                </Button>
            </Space>
        );
    const volumeOptions = VOLUME_STEPS.map((step) => ({
        value: step,
        label: t("cfw.volumeStep", { step }),
    }));
    const ledOptions = LED_LEVELS.map((level) => ({
        value: level,
        label: t(`cfw.ledLevel.${level}`),
    }));
    const sleepTimer = (
        <Space.Compact style={{ width: "100%" }}>
            <Select
                style={{ minWidth: 140 }}
                value={profile.sleepMinutes ? "on" : "off"}
                onChange={(value) =>
                    set("sleepMinutes", value === "off" ? null : profile.sleepMinutes || 30)
                }
                options={[
                    { value: "off", label: t("cfw.off") },
                    { value: "on", label: t("cfw.profile.sleepAfter") },
                ]}
            />
            {!!profile.sleepMinutes && (
                <InputNumber
                    min={1}
                    max={65535}
                    value={profile.sleepMinutes}
                    onChange={(value) => set("sleepMinutes", value ?? 1)}
                    suffix={t("cfw.minutes")}
                />
            )}
        </Space.Compact>
    );

    const fields: (Field & { input: React.ReactNode })[] = [
        {
            key: "resume",
            label: t("cfw.profile.resume"),
            // global resume includes resume: shown as on and locked
            hint: profile.globalResume
                ? t("cfw.profile.resumeByGlobal")
                : t("cfw.profile.resumeHint"),
            span: 12,
            input: toggle("resume", profile.globalResume === true),
        },
        {
            key: "globalResume",
            label: t("cfw.profile.globalResume"),
            hint: t("cfw.profile.globalResumeHint"),
            extra: oldBoxes.length > 0 && (
                <Text type="warning">
                    {t("cfw.profile.globalResumeOld", {
                        boxes: oldBoxes.map((b) => b.boxName || b.commonName || b.id).join(", "),
                    })}
                </Text>
            ),
            span: 12,
            input: toggle("globalResume"),
        },
        {
            key: "shuffle",
            label: t("cfw.profile.shuffle"),
            hint: t("cfw.profile.shuffleHint"),
            span: 12,
            input: toggle("shuffle"),
        },
        {
            key: "sleepMinutes",
            label: t("cfw.profile.sleepTimer"),
            hint: t("cfw.profile.sleepTimerHint"),
            span: 12,
            input: sleepTimer,
        },
        {
            key: "ledLevel",
            label: t("cfw.ledLevelLabel"),
            hint: t("cfw.profile.ledLevelHint"),
            span: 12,
            extra: origin("ledLevel"),
            input: numberSelect("ledLevel", ledOptions),
        },
        {
            key: "speakerLimit",
            label: t("cfw.speakerLimit"),
            hint: t("cfw.profile.limitHint"),
            span: 12,
            extra: origin("speakerLimit"),
            input: numberSelect("speakerLimit", volumeOptions),
        },
        {
            key: "headphoneLimit",
            label: t("cfw.headphoneLimit"),
            hint: t("cfw.profile.limitHint"),
            span: 12,
            extra: origin("headphoneLimit"),
            input: numberSelect("headphoneLimit", volumeOptions),
        },
        {
            key: "slapLock",
            label: t("cfw.slapLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            extra: origin("slapLock"),
            input: lockSwitch("slapLock"),
        },
        {
            key: "tiltLock",
            label: t("cfw.tiltLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            extra: origin("tiltLock"),
            input: lockSwitch("tiltLock"),
        },
        {
            key: "volumeLock",
            label: t("cfw.volumeLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            extra: origin("volumeLock"),
            input: lockSwitch("volumeLock"),
        },
    ];

    return (
        <Form layout="vertical">
            <Row gutter={16}>
                {fields.map((field) => (
                    <Col xs={24} sm={field.span} key={field.key}>
                        <Form.Item label={field.label} tooltip={field.hint} extra={field.extra}>
                            {field.input}
                        </Form.Item>
                    </Col>
                ))}
            </Row>
        </Form>
    );
};
