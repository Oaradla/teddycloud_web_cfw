import { useEffect, useState } from "react";

import { readSettingSwitch } from "./useCfwEnabled";

/**
 * whether the edit-tonie dialog shows the CFW settings of a tag: CFW support on (cfw.enabled) and
 * cfw.show_tag_settings
 */
export const useCfwTagSettingsVisible = (active: boolean): boolean => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!active) return;
        let current = true;
        Promise.all([
            readSettingSwitch("cfw.enabled"),
            readSettingSwitch("cfw.show_tag_settings"),
        ]).then(([enabled, show]) => current && setVisible(enabled && show));
        return () => {
            current = false;
        };
    }, [active]);

    return visible;
};
