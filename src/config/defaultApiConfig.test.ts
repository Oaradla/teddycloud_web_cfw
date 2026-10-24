// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetBasePathCache } from "../utils/basePath";
import { defaultAPIConfig } from "./defaultApiConfig";

const setBaseHref = (href: string) => {
    document.head.querySelectorAll("base").forEach((el) => el.remove());
    const base = document.createElement("base");
    base.href = href;
    document.head.appendChild(base);
    resetBasePathCache();
};

describe("defaultAPIConfig", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.stubEnv("VITE_APP_TEDDYCLOUD_API_URL", "");
        setBaseHref("http://localhost/web/");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        sessionStorage.clear();
        resetBasePathCache();
    });

    it("adds the stored bearer token and uses same-origin credentials", async () => {
        sessionStorage.setItem("teddycloud_web_token", "test-token");

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 200 }));

        const config = defaultAPIConfig();
        await config.fetchApi!("/api/fileIndexV2", { method: "GET" });

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [, init] = fetchMock.mock.calls[0];
        const headers = new Headers(init?.headers);

        expect(headers.get("Authorization")).toBe("Bearer test-token");
        expect(init?.credentials).toBe("same-origin");
    });

    it("does not add Authorization when no token is stored", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 200 }));

        const config = defaultAPIConfig();
        await config.fetchApi!("/api/stats", { method: "GET" });

        const [, init] = fetchMock.mock.calls[0];
        expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    });

    it("does not overwrite an explicit Authorization header", async () => {
        sessionStorage.setItem("teddycloud_web_token", "stored-token");

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 200 }));

        const config = defaultAPIConfig();
        await config.fetchApi!("/api/test", {
            headers: { Authorization: "Bearer explicit-token" },
        });

        const [, init] = fetchMock.mock.calls[0];
        const headers = new Headers(init?.headers);

        expect(headers.get("Authorization")).toBe("Bearer explicit-token");
    });

    it("keeps existing request headers while adding Authorization", async () => {
        sessionStorage.setItem("teddycloud_web_token", "token");
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 200 }));

        const config = defaultAPIConfig();
        await config.fetchApi!("/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Test": "yes" },
        });

        const [, init] = fetchMock.mock.calls[0];
        const headers = new Headers(init?.headers);

        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("X-Test")).toBe("yes");
    });

    it("dispatches auth-required for a protected 401 response", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: "unauthorized", message: "Login required" }), {
                status: 401,
            }),
        );
        const authRequired = vi.fn();
        window.addEventListener("teddycloud-auth-required", authRequired);

        try {
            const config = defaultAPIConfig();
            await config.fetchApi!("/api/fileIndexV2", { method: "GET" });

            expect(authRequired).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener("teddycloud-auth-required", authRequired);
        }
    });

    it("does not dispatch auth-required for a 401 passed on from the cloud", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
        const authRequired = vi.fn();
        window.addEventListener("teddycloud-auth-required", authRequired);

        try {
            const config = defaultAPIConfig();
            const response = await config.fetchApi!("/content/download/F87FFC14/45000304E0", {
                method: "GET",
            });

            expect(authRequired).not.toHaveBeenCalled();
            expect(response.status).toBe(401);
        } finally {
            window.removeEventListener("teddycloud-auth-required", authRequired);
        }
    });

    it("does not dispatch auth-required for auth endpoints", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
        const authRequired = vi.fn();
        window.addEventListener("teddycloud-auth-required", authRequired);

        try {
            const config = defaultAPIConfig();
            await config.fetchApi!("/api/auth/status", { method: "GET" });

            expect(authRequired).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener("teddycloud-auth-required", authRequired);
        }
    });

    it("does not dispatch auth-required for a successful protected request", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
        const authRequired = vi.fn();
        window.addEventListener("teddycloud-auth-required", authRequired);

        try {
            const config = defaultAPIConfig();
            await config.fetchApi!("/api/fileIndexV2", { method: "GET" });

            expect(authRequired).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener("teddycloud-auth-required", authRequired);
        }
    });

    it("uses the runtime reverse-proxy prefix as basePath", () => {
        setBaseHref("http://localhost/api/hassio_ingress/abc/web/");

        const config = defaultAPIConfig();

        expect(config.basePath).toBe("/api/hassio_ingress/abc");
    });

    it("prefers VITE_APP_TEDDYCLOUD_API_URL over the runtime prefix", () => {
        setBaseHref("http://localhost/api/hassio_ingress/abc/web/");
        vi.stubEnv("VITE_APP_TEDDYCLOUD_API_URL", "http://teddycloud.local:8080");

        const config = defaultAPIConfig();

        expect(config.basePath).toBe("http://teddycloud.local:8080");
    });
});

describe("defaultAPIConfig re-authentication", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_APP_TEDDYCLOUD_API_URL", "");
        setBaseHref("http://localhost/web/");
    });

    afterEach(async () => {
        const { registerReauthHandler } = await import("../utils/auth/reauth");
        registerReauthHandler(null);
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        resetBasePathCache();
    });

    const reauthResponse = () =>
        new Response(JSON.stringify({ error: "reauth_required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });

    it("asks for the password once and sends the request again", async () => {
        const { registerReauthHandler } = await import("../utils/auth/reauth");
        const handler = vi.fn(async () => true);
        registerReauthHandler(handler);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(reauthResponse())
            .mockResolvedValueOnce(new Response("{}", { status: 200 }));

        const response = await defaultAPIConfig().fetchApi!("/api/auth/users/create", {
            method: "POST",
            body: "{}",
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
    });

    it("returns the 403 when the confirmation is cancelled", async () => {
        const { registerReauthHandler } = await import("../utils/auth/reauth");
        registerReauthHandler(async () => false);
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reauthResponse());

        const response = await defaultAPIConfig().fetchApi!("/api/auth/users/delete", {
            method: "POST",
            body: "{}",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(403);
    });
});
