import { useEffect, useState } from "react";

import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";

const api = new TeddyCloudApi(defaultAPIConfig());

/**
 * a switch of the server's settings, of the box when overlay is given; false when it cannot be read,
 * e.g. on a teddyCloud without CFW support, which has no cfw.* settings
 */
export const readSettingSwitch = async (name: string, overlay?: string): Promise<boolean> => {
    try {
        const response = await api.apiGetTeddyCloudSettingRaw(name, overlay);
        return (await response.text()).trim() === "true";
    } catch {
        return false;
    }
};

/**
 * whether teddyCloud's custom firmware support is on (cfw.enabled, of the box when overlay is given);
 * undefined while it is read. Everything of the CFW stays hidden unless this is true.
 * A changed reloadKey reads it again.
 */
export const useCfwEnabled = (overlay?: string, reloadKey = 0): boolean | undefined => {
    const [enabled, setEnabled] = useState<boolean | undefined>();

    useEffect(() => {
        let current = true;
        setEnabled(undefined);
        readSettingSwitch("cfw.enabled", overlay).then((value) => current && setEnabled(value));
        return () => {
            current = false;
        };
    }, [overlay, reloadKey]);

    return enabled;
};
