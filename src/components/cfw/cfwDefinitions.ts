// Event tag actions and setting values of the custom firmware.

export type CfwScope = "figure" | "global";

/** which modes an action uses: all four, set/remove (values set with the ears), or none */
export type CfwModeSet = "all" | "earsSet" | "none";

export type CfwValueKind =
    "none" | "minutes" | "minutesOnce" | "idleMinutes" | "volumeStart" | "ledStart";

export interface CfwActionDef {
    action: number;
    key: string;
    scope: CfwScope;
    modes: CfwModeSet;
    value: CfwValueKind;
}

export const CFW_ACTIONS: CfwActionDef[] = [
    { action: 1, key: "resume", scope: "figure", modes: "all", value: "none" },
    { action: 2, key: "shuffle", scope: "figure", modes: "all", value: "none" },
    { action: 3, key: "sleepTimer", scope: "figure", modes: "all", value: "minutes" },
    { action: 4, key: "sleepTimerOnce", scope: "figure", modes: "none", value: "minutesOnce" },
    {
        action: 5,
        key: "volumeLimitFigure",
        scope: "figure",
        modes: "earsSet",
        value: "volumeStart",
    },
    { action: 6, key: "ledLevelFigure", scope: "figure", modes: "earsSet", value: "ledStart" },
    { action: 7, key: "resetProfile", scope: "figure", modes: "none", value: "none" },
    { action: 10, key: "slapLockFigure", scope: "figure", modes: "all", value: "none" },
    { action: 11, key: "tiltLockFigure", scope: "figure", modes: "all", value: "none" },
    { action: 12, key: "volumeLockFigure", scope: "figure", modes: "all", value: "none" },
    { action: 8, key: "ledLevelGlobal", scope: "global", modes: "earsSet", value: "ledStart" },
    {
        action: 9,
        key: "volumeLimitGlobal",
        scope: "global",
        modes: "earsSet",
        value: "volumeStart",
    },
    { action: 13, key: "slapLockGlobal", scope: "global", modes: "all", value: "none" },
    { action: 14, key: "tiltLockGlobal", scope: "global", modes: "all", value: "none" },
    { action: 15, key: "volumeLockGlobal", scope: "global", modes: "all", value: "none" },
    { action: 16, key: "bothEarsOff", scope: "global", modes: "all", value: "none" },
    { action: 17, key: "idleOffBattery", scope: "global", modes: "none", value: "idleMinutes" },
    { action: 18, key: "idleOffStation", scope: "global", modes: "none", value: "idleMinutes" },
];

export const actionDef = (action: number) => CFW_ACTIONS.find((a) => a.action === action);

/** the scope of the first known action */
export const scopeOfActions = (actions: { action: number }[]): CfwScope =>
    actions.map((a) => actionDef(a.action)).find((def) => def !== undefined)?.scope ?? "figure";

/** default value of a newly added action */
export const defaultValue = (def: CfwActionDef): number => {
    switch (def.value) {
        case "minutes":
        case "minutesOnce":
        case "idleMinutes":
            return 30;
        case "volumeStart":
            return 0; // the step in effect
        case "ledStart":
            return 3; // the level in effect
        default:
            return 0;
    }
};

/** LED levels of the box */
export const LED_LEVELS = [0, 2, 1];

export const VOLUME_STEPS = Array.from({ length: 16 }, (_, i) => i);
