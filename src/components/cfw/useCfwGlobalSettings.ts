import { useEffect, useState } from "react";

import SettingsDataHandler from "../../data/SettingsDataHandler";
import { CfwGlobalState } from "./cfwSettingsVisibility";
import { useCfwEnabled } from "./useCfwEnabled";

/**
 * the CFW switches of the global settings page, live while they are edited: switching CFW support or
 * the CFW box settings on or off shows or hides their settings at once
 */
export const useCfwGlobalSettings = (settingsLoaded: boolean): CfwGlobalState => {
    // cfw.enabled is a Detail setting: read it directly while the list does not hold it
    const enabledOnServer = useCfwEnabled();
    const [state, setState] = useState<CfwGlobalState>({ enabled: false, showBoxSettings: false });

    useEffect(() => {
        if (!settingsLoaded) return;
        const handler = SettingsDataHandler.getInstance();
        const read = () => {
            const enabled = handler.getSetting("cfw.enabled");
            setState({
                enabled: enabled ? String(enabled.value) === "true" : Boolean(enabledOnServer),
                showBoxSettings:
                    String(handler.getSetting("cfw.show_box_settings")?.value) === "true",
            });
        };
        read();
        handler.addListener(read);
        return () => handler.removeListener(read);
    }, [settingsLoaded, enabledOnServer]);

    return state;
};
