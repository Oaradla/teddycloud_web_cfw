import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Form, InputNumber, Radio, Select, Space, Switch, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

import { CfwAction, CfwEvent } from "../../api/cfwApi";
import {
    CFW_ACTIONS,
    CfwScope,
    LED_LEVELS,
    VOLUME_STEPS,
    actionDef,
    defaultValue,
    scopeOfActions,
} from "./cfwDefinitions";

const { Text } = Typography;

const MODE_REMOVE = 3;

interface CfwEventFormProps {
    event: CfwEvent;
    onChange: (event: CfwEvent) => void;
}

/** an event tag: its scope, up to 16 actions and the feedback tones */
export const CfwEventForm: React.FC<CfwEventFormProps> = ({ event, onChange }) => {
    const { t } = useTranslation();
    const scope: CfwScope = scopeOfActions(event.actions);
    const setActions = (actions: CfwAction[]) => onChange({ ...event, actions });
    const newAction = (inScope: CfwScope): CfwAction => {
        const def = CFW_ACTIONS.find((d) => d.scope === inScope)!;
        return { action: def.action, mode: 0, value: defaultValue(def) };
    };
    const update = (index: number, change: Partial<CfwAction>) =>
        setActions(
            event.actions.map((action, i) => (i === index ? { ...action, ...change } : action)),
        );

    const valueInput = (action: CfwAction, index: number) => {
        const def = actionDef(action.action);
        if (def === undefined || action.mode === MODE_REMOVE) return null;
        switch (def.value) {
            case "minutes":
            case "minutesOnce":
                return action.mode === 2 ? null : (
                    <InputNumber
                        min={def.value === "minutes" ? 1 : 0}
                        max={16383}
                        value={action.value}
                        onChange={(value) => update(index, { value: value ?? 0 })}
                        suffix={t("cfw.minutes")}
                    />
                );
            case "volumeStart":
                return (
                    <Select
                        style={{ width: 200 }}
                        value={action.value}
                        onChange={(value) => update(index, { value })}
                        options={[
                            { value: 0, label: t("cfw.startCurrentVolume") },
                            ...VOLUME_STEPS.map((step) => ({
                                value: step + 1,
                                label: t("cfw.startVolume", { step }),
                            })),
                        ]}
                    />
                );
            case "ledStart":
                return (
                    <Select
                        style={{ width: 200 }}
                        value={action.value}
                        onChange={(value) => update(index, { value })}
                        options={[
                            { value: 3, label: t("cfw.startCurrentLed") },
                            ...LED_LEVELS.map((level) => ({
                                value: level,
                                label: t("cfw.startLed", { level: t(`cfw.ledLevel.${level}`) }),
                            })),
                        ]}
                    />
                );
            default:
                return null;
        }
    };

    const modeSelect = (action: CfwAction, index: number) => {
        const def = actionDef(action.action);
        if (def?.modes === "all") {
            return (
                <Select
                    style={{ width: 160 }}
                    value={action.mode}
                    onChange={(mode) => update(index, { mode })}
                    options={[0, 1, 2, 3].map((mode) => ({
                        value: mode,
                        label: t(`cfw.mode.${mode}`),
                    }))}
                />
            );
        }
        if (def?.modes === "earsSet") {
            return (
                <Select
                    style={{ width: 200 }}
                    value={action.mode === MODE_REMOVE ? MODE_REMOVE : 0}
                    onChange={(mode) => update(index, { mode })}
                    options={[
                        { value: 0, label: t("cfw.mode.earsSet") },
                        { value: MODE_REMOVE, label: t("cfw.mode.remove") },
                    ]}
                />
            );
        }
        return null;
    };

    /** only the first volume and the first LED action set with the ears count */
    const ignoredEarsAction = (action: CfwAction, index: number) => {
        const kind = actionDef(action.action)?.value;
        return (
            (kind === "volumeStart" || kind === "ledStart") &&
            action.mode !== MODE_REMOVE &&
            event.actions.some(
                (other, i) =>
                    i < index &&
                    actionDef(other.action)?.value === kind &&
                    other.mode !== MODE_REMOVE,
            )
        );
    };

    return (
        <Form layout="vertical">
            <Form.Item label={t("cfw.event.scope")} tooltip={t("cfw.event.scopeHint")}>
                <Radio.Group
                    value={scope}
                    onChange={(e) =>
                        e.target.value !== scope && setActions([newAction(e.target.value)])
                    }
                >
                    <Radio.Button value="figure">{t("cfw.event.scopeFigure")}</Radio.Button>
                    <Radio.Button value="global">{t("cfw.event.scopeGlobal")}</Radio.Button>
                </Radio.Group>
            </Form.Item>
            <Form.Item label={t("cfw.event.actions")}>
                {event.actions.map((action, index) => (
                    <Space
                        key={index}
                        wrap
                        style={{ marginBottom: 8, width: "100%" }}
                        align="start"
                    >
                        <Select
                            style={{ width: 260 }}
                            value={action.action}
                            onChange={(number) =>
                                update(index, {
                                    action: number,
                                    mode: 0,
                                    value: defaultValue(actionDef(number)!),
                                })
                            }
                            options={CFW_ACTIONS.filter((d) => d.scope === scope).map((d) => ({
                                value: d.action,
                                label: t(`cfw.action.${d.key}`),
                            }))}
                        />
                        {modeSelect(action, index)}
                        {valueInput(action, index)}
                        <Tooltip title={t("cfw.removeAction")}>
                            <Button
                                icon={<DeleteOutlined />}
                                disabled={event.actions.length <= 1}
                                onClick={() =>
                                    setActions(event.actions.filter((_, i) => i !== index))
                                }
                            />
                        </Tooltip>
                        {ignoredEarsAction(action, index) && (
                            <Text type="warning">{t("cfw.secondEarsActionIgnored")}</Text>
                        )}
                    </Space>
                ))}
                <Button
                    icon={<PlusOutlined />}
                    disabled={event.actions.length >= 16}
                    onClick={() => setActions([...event.actions, newAction(scope)])}
                >
                    {t("cfw.addAction")}
                </Button>
            </Form.Item>
            <Form.Item label={t("cfw.event.tones")} tooltip={t("cfw.event.tonesHint")}>
                <Switch checked={event.tones} onChange={(tones) => onChange({ ...event, tones })} />
            </Form.Item>
        </Form>
    );
};
