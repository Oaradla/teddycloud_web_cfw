// Which settings the custom firmware (CFW) adds to or replaces in the settings lists.

/** settings of the box-wide CFW functions */
const isCfwBoxSetting = (id: string) => id.startsWith("cfw.box.");

/** CFW switches that matter per box */
const CFW_BOX_SWITCHES = ["cfw.settings_sync", "cfw.remote_control"];

/** old settings replaced by the CFW box settings; boxes without CFW get them derived */
const REPLACED_BY_CFW = ["toniebox.max_vol_spk", "toniebox.max_vol_hdp", "toniebox.slap_enabled"];

/** what a toniebox's settings dialog offers (matched as part of the id); the rest is server-wide */
const BOX_DIALOG = [
    "core.certdir",
    "core.client_cert.",
    "core.flex_",
    "core.contentdir",
    "toniebox.",
    "cloud.enabled",
    "cloud.enableV1Claim",
    "cloud.enableV1CloudReset",
    "cloud.enableV1FreshnessCheck",
    "cloud.enableV1Log",
    "cloud.enableV1Time",
    "cloud.enableV1Ota",
    "cloud.enableV2Content",
    "cloud.cacheOta",
    "cloud.localOta",
    "cloud.cacheContent",
    "cloud.cacheToLibrary",
    "cloud.markCustomTagByPass",
    "cloud.prioCustomContent",
    "cloud.updateOnLowerAudioId",
    "cloud.dumpRuidAuthContentJson",
];

/** a setting of the CFW support that only matters while it is on (all cfw.* but the main switch) */
const needsCfwEnabled = (id: string) => id.startsWith("cfw.") && id !== "cfw.enabled";

/** the CFW switches the global settings page depends on */
export interface CfwGlobalState {
    /** cfw.enabled */
    enabled: boolean;
    /** cfw.show_box_settings */
    showBoxSettings: boolean;
}

/**
 * global settings page: nothing of the CFW but its main switch while it is off; the CFW box settings
 * while they are shown, the old ones otherwise
 */
export const hiddenInGlobalSettings = (id: string, cfw: CfwGlobalState) => {
    if (needsCfwEnabled(id) && !cfw.enabled) return true;
    const boxSettingsShown = cfw.enabled && cfw.showBoxSettings;
    return (
        (isCfwBoxSetting(id) && !boxSettingsShown) ||
        (REPLACED_BY_CFW.includes(id) && boxSettingsShown) ||
        id === "cfw.force_box_settings"
    );
};

/** what the settings dialog of a toniebox knows about the CFW */
export interface CfwBoxDialogState {
    /** cfw.enabled for this box */
    enabled: boolean;
    /** the box connected with the CFW */
    isCfwBox: boolean;
    /** cfw.force_box_settings of this box */
    forced: boolean;
}

/**
 * toniebox dialog: the CFW settings for a box with CFW or with them forced, the old ones otherwise;
 * an old setting with a value of this box stays, as that value still applies. While CFW support is
 * off for the box, only its main switch stays (for a box that would show it), to switch it on again
 */
export const shownInBoxDialog = (id: string, cfw: CfwBoxDialogState, overlayed: boolean) => {
    const cfwBox = cfw.isCfwBox || cfw.forced;
    const cfwShown = cfw.enabled && cfwBox;
    if (id.includes("core.settings_level")) return false;
    if (id === "cfw.enabled") return cfwBox;
    if (needsCfwEnabled(id) && !cfw.enabled) return false;
    if (isCfwBoxSetting(id) || CFW_BOX_SWITCHES.includes(id)) return cfwShown;
    if (id === "cfw.force_box_settings") return !cfw.isCfwBox;
    // the notice an event tag plays is only for boxes without the CFW
    if (id === "cfw.event_notice_language") return !cfw.isCfwBox;
    if (REPLACED_BY_CFW.includes(id)) return !cfwShown || overlayed;
    return BOX_DIALOG.some((part) => id.includes(part));
};

/** for which boxes a setting of the box dialog is there at all: only with the CFW, only without, or every box */
export const boxSettingScope = (id: string): "cfw" | "plain" | undefined => {
    if (id === "cfw.enabled" || isCfwBoxSetting(id) || CFW_BOX_SWITCHES.includes(id)) return "cfw";
    if (
        id === "cfw.force_box_settings" ||
        id === "cfw.event_notice_language" ||
        REPLACED_BY_CFW.includes(id)
    )
        return "plain";
    return undefined;
};
