import type { TFunction } from "i18next";

import { AuthApiError } from "../../../utils/auth/webAuthApi";

export const formatTime = (seconds: number, never: string): string =>
    seconds > 0 ? new Date(seconds * 1000).toLocaleString() : never;

/** translated message for a server error code, otherwise the server's text */
export const authErrorText = (t: TFunction, err: unknown): string => {
    if (err instanceof AuthApiError) {
        const key = `settings.webAuth.errors.${err.code}`;
        const translated = t(key);
        return translated !== key ? translated : err.message;
    }
    return err instanceof Error ? err.message : t("settings.webAuth.saveFailed");
};

/** short browser and OS name from a User-Agent */
export const shortUserAgent = (ua: string): string => {
    if (!ua) {
        return "";
    }
    const browser = /Edg\//.test(ua)
        ? "Edge"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : ua.split(" ")[0];
    const os = /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Mac OS X/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
    return os ? `${browser} · ${os}` : browser;
};
