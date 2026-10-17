import { useEffect, useState } from "react";

import SettingsDataHandler from "../../data/SettingsDataHandler";
import { findCfwBox, useCfwBoxes } from "./useCfwBoxes";
import { readSettingSwitch, useCfwEnabled } from "./useCfwEnabled";
import { CfwBoxDialogState } from "./cfwSettingsVisibility";

/**
 * what the settings dialog of a toniebox needs to know about the custom firmware: the CFW settings
 * appear for a box that runs the custom firmware, or when forced for this box
 */
export const useCfwBoxDialog = (overlay: string, settingsLoaded: boolean): CfwBoxDialogState => {
    const { boxes } = useCfwBoxes({ active: useCfwEnabled(), refreshKey: overlay });
    const isCfwBox = Boolean(findCfwBox(boxes, overlay)?.isCfw);

    // both switches are Detail settings: read them directly, the list may not hold them; while it
    // holds them, their values there count, so that a change shows at once
    const enabledOnServer = useCfwEnabled(overlay);
    const [forcedOnServer, setForcedOnServer] = useState(false);
    useEffect(() => {
        let current = true;
        readSettingSwitch("cfw.force_box_settings", overlay).then(
            (value) => current && setForcedOnServer(value),
        );
        return () => {
            current = false;
        };
    }, [overlay]);
    const setting = (name: string) =>
        settingsLoaded ? SettingsDataHandler.getInstance().getSetting(name) : undefined;
    const enabledSetting = setting("cfw.enabled");
    const forceSetting = setting("cfw.force_box_settings");

    return {
        enabled: enabledSetting
            ? String(enabledSetting.value) === "true"
            : Boolean(enabledOnServer),
        isCfwBox,
        forced: forceSetting ? String(forceSetting.value) === "true" : forcedOnServer,
    };
};
