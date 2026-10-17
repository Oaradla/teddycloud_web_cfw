import { describe, expect, it } from "vitest";

import {
    CfwBoxDialogState,
    hiddenInGlobalSettings,
    shownInBoxDialog,
} from "./cfwSettingsVisibility";

const on = { enabled: true, showBoxSettings: false };
const onWithBoxSettings = { enabled: true, showBoxSettings: true };
const off = { enabled: false, showBoxSettings: true };

const cfwBox: CfwBoxDialogState = { enabled: true, isCfwBox: true, forced: false };
const otherBox: CfwBoxDialogState = { enabled: true, isCfwBox: false, forced: false };
const forcedBox: CfwBoxDialogState = { enabled: true, isCfwBox: false, forced: true };

describe("hiddenInGlobalSettings", () => {
    it("shows the old limits until the CFW box settings are shown", () => {
        expect(hiddenInGlobalSettings("toniebox.max_vol_spk", on)).toBe(false);
        expect(hiddenInGlobalSettings("cfw.box.speaker_limit", on)).toBe(true);
    });

    it("replaces the old limits by the CFW box settings", () => {
        expect(hiddenInGlobalSettings("toniebox.max_vol_spk", onWithBoxSettings)).toBe(true);
        expect(hiddenInGlobalSettings("toniebox.slap_enabled", onWithBoxSettings)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.box.speaker_limit", onWithBoxSettings)).toBe(false);
    });

    it("never shows the per-box force option", () => {
        expect(hiddenInGlobalSettings("cfw.force_box_settings", onWithBoxSettings)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.force_box_settings", on)).toBe(true);
    });

    it("shows only the main switch while CFW support is off", () => {
        expect(hiddenInGlobalSettings("cfw.enabled", off)).toBe(false);
        expect(hiddenInGlobalSettings("cfw.show_tag_settings", off)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.show_battery", off)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.update.channel", off)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.box.speaker_limit", off)).toBe(true);
        expect(hiddenInGlobalSettings("cfw.show_tag_settings", on)).toBe(false);
    });

    it("keeps the old limits while CFW support is off", () => {
        expect(hiddenInGlobalSettings("toniebox.max_vol_spk", off)).toBe(false);
        expect(hiddenInGlobalSettings("toniebox.slap_enabled", off)).toBe(false);
    });
});

describe("shownInBoxDialog", () => {
    it("shows the CFW settings for a CFW box", () => {
        expect(shownInBoxDialog("cfw.box.slap_lock", cfwBox, false)).toBe(true);
        expect(shownInBoxDialog("cfw.remote_control", cfwBox, false)).toBe(true);
        expect(shownInBoxDialog("cfw.enabled", cfwBox, false)).toBe(true);
        expect(shownInBoxDialog("toniebox.max_vol_spk", cfwBox, false)).toBe(false);
    });

    it("shows the CFW settings for another box only when forced", () => {
        expect(shownInBoxDialog("cfw.box.slap_lock", otherBox, false)).toBe(false);
        expect(shownInBoxDialog("cfw.enabled", otherBox, false)).toBe(false);
        expect(shownInBoxDialog("cfw.box.slap_lock", forcedBox, false)).toBe(true);
        expect(shownInBoxDialog("toniebox.max_vol_spk", otherBox, false)).toBe(true);
        expect(shownInBoxDialog("toniebox.max_vol_spk", forcedBox, false)).toBe(false);
    });

    it("keeps an old setting the box has its own value for", () => {
        expect(shownInBoxDialog("toniebox.max_vol_spk", cfwBox, true)).toBe(true);
    });

    it("offers the force option only to boxes without CFW", () => {
        expect(shownInBoxDialog("cfw.force_box_settings", otherBox, false)).toBe(true);
        expect(shownInBoxDialog("cfw.event_notice_language", otherBox, false)).toBe(true);
        expect(shownInBoxDialog("cfw.event_notice_language", cfwBox, false)).toBe(false);
        expect(shownInBoxDialog("cfw.force_box_settings", cfwBox, false)).toBe(false);
    });

    it("keeps server-wide settings out", () => {
        expect(shownInBoxDialog("core.settings_level", cfwBox, false)).toBe(false);
        expect(shownInBoxDialog("cfw.show_box_settings", cfwBox, false)).toBe(false);
        expect(shownInBoxDialog("mqtt.enabled", cfwBox, false)).toBe(false);
        expect(shownInBoxDialog("cloud.enabled", cfwBox, false)).toBe(true);
    });

    it("shows only the main switch while CFW support is off for the box", () => {
        const cfwBoxOff = { ...cfwBox, enabled: false };
        const otherBoxOff = { ...otherBox, enabled: false };
        expect(shownInBoxDialog("cfw.enabled", cfwBoxOff, false)).toBe(true);
        expect(shownInBoxDialog("cfw.box.slap_lock", cfwBoxOff, false)).toBe(false);
        expect(shownInBoxDialog("cfw.remote_control", cfwBoxOff, false)).toBe(false);
        expect(shownInBoxDialog("cfw.force_box_settings", otherBoxOff, false)).toBe(false);
        expect(shownInBoxDialog("cfw.event_notice_language", otherBoxOff, false)).toBe(false);
        expect(shownInBoxDialog("cfw.box.slap_lock", { ...forcedBox, enabled: false }, false)).toBe(
            false,
        );
    });

    it("gives the old settings back while CFW support is off for the box", () => {
        const cfwBoxOff = { ...cfwBox, enabled: false };
        expect(shownInBoxDialog("toniebox.max_vol_spk", cfwBoxOff, false)).toBe(true);
        expect(shownInBoxDialog("toniebox.slap_enabled", cfwBoxOff, false)).toBe(true);
    });
});
