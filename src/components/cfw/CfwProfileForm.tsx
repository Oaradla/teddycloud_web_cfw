import React from "react";
import { useTranslation } from "react-i18next";
import { Col, Form, InputNumber, Row, Select, Space } from "antd";

import { CfwProfile } from "../../api/cfwApi";
import { LED_LEVELS, VOLUME_STEPS } from "./cfwDefinitions";

const NOT_SET = "notSet";

type Field = {
    key: keyof CfwProfile;
    label: string;
    hint?: string;
    span: number;
};

interface CfwProfileFormProps {
    profile: CfwProfile;
    onChange: (profile: CfwProfile) => void;
}

/** the settings of a figure; "not set" leaves the box's behaviour */
export const CfwProfileForm: React.FC<CfwProfileFormProps> = ({ profile, onChange }) => {
    const { t } = useTranslation();
    const set = (key: keyof CfwProfile, value: boolean | number | null) =>
        onChange({ ...profile, [key]: value });

    const boolSelect = (key: keyof CfwProfile, on: string, off: string) => (
        <Select
            value={profile[key] === null ? NOT_SET : profile[key] ? "on" : "off"}
            onChange={(value) => set(key, value === NOT_SET ? null : value === "on")}
            options={[
                { value: NOT_SET, label: t("cfw.notSet") },
                { value: "on", label: on },
                { value: "off", label: off },
            ]}
        />
    );
    const numberSelect = (key: keyof CfwProfile, options: { value: number; label: string }[]) => (
        <Select
            value={profile[key] === null ? NOT_SET : (profile[key] as number)}
            onChange={(value) => set(key, value === NOT_SET ? null : Number(value))}
            options={[{ value: NOT_SET, label: t("cfw.notSet") }, ...options]}
        />
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
                value={
                    profile.sleepMinutes === null
                        ? NOT_SET
                        : profile.sleepMinutes === 0
                          ? "off"
                          : "on"
                }
                onChange={(value) =>
                    set(
                        "sleepMinutes",
                        value === NOT_SET ? null : value === "off" ? 0 : profile.sleepMinutes || 30,
                    )
                }
                options={[
                    { value: NOT_SET, label: t("cfw.notSet") },
                    { value: "off", label: t("cfw.off") },
                    { value: "on", label: t("cfw.profile.sleepAfter") },
                ]}
            />
            {profile.sleepMinutes !== null && profile.sleepMinutes > 0 && (
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
            hint: t("cfw.profile.resumeHint"),
            span: 12,
            input: boolSelect("resume", t("cfw.on"), t("cfw.off")),
        },
        {
            key: "shuffle",
            label: t("cfw.profile.shuffle"),
            hint: t("cfw.profile.shuffleHint"),
            span: 12,
            input: boolSelect("shuffle", t("cfw.on"), t("cfw.off")),
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
            input: numberSelect("ledLevel", ledOptions),
        },
        {
            key: "speakerLimit",
            label: t("cfw.speakerLimit"),
            hint: t("cfw.profile.limitHint"),
            span: 12,
            input: numberSelect("speakerLimit", volumeOptions),
        },
        {
            key: "headphoneLimit",
            label: t("cfw.headphoneLimit"),
            hint: t("cfw.profile.limitHint"),
            span: 12,
            input: numberSelect("headphoneLimit", volumeOptions),
        },
        {
            key: "slapLock",
            label: t("cfw.slapLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            input: boolSelect("slapLock", t("cfw.locked"), t("cfw.unlocked")),
        },
        {
            key: "tiltLock",
            label: t("cfw.tiltLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            input: boolSelect("tiltLock", t("cfw.locked"), t("cfw.unlocked")),
        },
        {
            key: "volumeLock",
            label: t("cfw.volumeLock"),
            hint: t("cfw.profile.lockHint"),
            span: 8,
            input: boolSelect("volumeLock", t("cfw.locked"), t("cfw.unlocked")),
        },
    ];

    return (
        <Form layout="vertical">
            <Row gutter={16}>
                {fields.map((field) => (
                    <Col xs={24} sm={field.span} key={field.key}>
                        <Form.Item label={field.label} tooltip={field.hint}>
                            {field.input}
                        </Form.Item>
                    </Col>
                ))}
            </Row>
        </Form>
    );
};
