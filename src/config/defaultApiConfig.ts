import { Configuration } from "../api";
import { isReauthRequired, requestReauth } from "../utils/auth/reauth";
import { getBasePath as getRuntimeBasePath } from "../utils/basePath";

/**
 * Use the runtime URL prefix (usually empty) as basePath in browser so API requests are
 * same-origin (relative URLs). This fixes FetchError when the app is accessed via port
 * forwarding (e.g. devcontainer) and keeps working behind a reverse proxy sub-path.
 */
const getBasePath = (): string => {
    const envUrl = import.meta.env.VITE_APP_TEDDYCLOUD_API_URL;
    if (envUrl && String(envUrl).trim()) {
        return String(envUrl).trim();
    }
    if (typeof window !== "undefined") {
        return getRuntimeBasePath();
    }
    return "http://localhost";
};

export const defaultAPIConfig = () =>
    new Configuration({
        basePath: getBasePath(),
        credentials: "same-origin",
        fetchApi: async (url, init) => {
            const headers = new Headers(init?.headers);
            try {
                const token = sessionStorage.getItem("teddycloud_web_token");
                if (token && !headers.has("Authorization")) {
                    headers.set("Authorization", `Bearer ${token}`);
                }
            } catch {
                /* ignore */
            }
            let response = await fetch(url, { ...init, headers, credentials: "same-origin" });
            // a sensitive change needs the password again; streams can not be sent twice
            const body = init?.body;
            const resendable = !(
                typeof ReadableStream !== "undefined" && body instanceof ReadableStream
            );
            if (resendable && (await isReauthRequired(response)) && (await requestReauth())) {
                response = await fetch(url, { ...init, headers, credentials: "same-origin" });
            }
            if (response.status === 401) {
                const path = typeof url === "string" ? url : url.toString();
                if (!path.includes("/api/auth/")) {
                    window.dispatchEvent(new Event("teddycloud-auth-required"));
                }
            }
            return response;
        },
    });
