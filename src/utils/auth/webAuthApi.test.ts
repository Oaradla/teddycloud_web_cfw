// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        apiGetTeddyCloudApiRaw: vi.fn(),
        apiPostTeddyCloudJsonRaw: vi.fn(),
    },
}));

vi.mock("../../api", () => ({
    TeddyCloudApi: class {
        apiGetTeddyCloudApiRaw = apiMock.apiGetTeddyCloudApiRaw;
        apiPostTeddyCloudJsonRaw = apiMock.apiPostTeddyCloudJsonRaw;
    },
}));

vi.mock("../../config/defaultApiConfig", () => ({
    defaultAPIConfig: vi.fn(() => ({})),
}));

import {
    changeAuthPassword,
    createAuthUser,
    deleteAuthUser,
    fetchAuthStatus,
    fetchAuthUsers,
    disableTwoFactor,
    getStoredToken,
    login,
    loginSecondFactor,
    logout,
    renewRecoveryCodes,
    setAuthEnabled,
    setStoredToken,
} from "./webAuthApi";

const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });

describe("webAuthApi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        // the UI on the same origin as the API, as in production
        vi.stubEnv("VITE_APP_TEDDYCLOUD_API_URL", "");
        sessionStorage.clear();
    });

    describe("token storage", () => {
        it("does not store a token for a same-origin UI", () => {
            setStoredToken("abc123");
            expect(getStoredToken()).toBeNull();
        });

        it("removes the token when null is passed", () => {
            sessionStorage.setItem("teddycloud_web_token", "abc123");
            setStoredToken(null);
            expect(getStoredToken()).toBeNull();
        });
    });

    describe("fetchAuthStatus", () => {
        it("returns a valid authentication status", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(
                jsonResponse({
                    enabled: true,
                    loggedIn: true,
                    username: "alice",
                    envOverride: false,
                    userCount: 2,
                }),
            );

            await expect(fetchAuthStatus()).resolves.toEqual({
                enabled: true,
                loggedIn: true,
                username: "alice",
                envOverride: false,
                userCount: 2,
                twoFactorSetupRequired: false,
                passwordChangeRequired: false,
                twoFactorEnabled: false,
                twoFactorRequired: false,
                recoveryCodesLeft: 0,
                passwordMinLength: 10,
                client: undefined,
            });

            expect(apiMock.apiGetTeddyCloudApiRaw).toHaveBeenCalledWith("/api/auth/status");
        });

        it("uses defaults for optional fields", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(
                jsonResponse({ enabled: false, loggedIn: false }),
            );

            await expect(fetchAuthStatus()).resolves.toEqual({
                enabled: false,
                loggedIn: false,
                username: "",
                envOverride: false,
                userCount: 0,
                twoFactorSetupRequired: false,
                passwordChangeRequired: false,
                twoFactorEnabled: false,
                twoFactorRequired: false,
                recoveryCodesLeft: 0,
                passwordMinLength: 10,
                client: undefined,
            });
        });

        it("rejects a failed status request instead of treating auth as disabled", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(
                jsonResponse({ message: "backend unavailable" }, 503),
            );

            await expect(fetchAuthStatus()).rejects.toThrow("backend unavailable");
        });

        it("uses an HTTP fallback message when the backend returns no message", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(new Response("", { status: 502 }));

            await expect(fetchAuthStatus()).rejects.toThrow(
                "Could not load authentication status (HTTP 502)",
            );
        });

        it("rejects an invalid status payload instead of coercing missing values to false", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(jsonResponse({ username: "alice" }));

            await expect(fetchAuthStatus()).rejects.toThrow(
                "Invalid authentication status response",
            );
        });
    });

    describe("login", () => {
        it("posts credentials and returns the refreshed status, the cookie is the session", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ ok: true, token: "new-token" }),
            );
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(
                jsonResponse({
                    enabled: true,
                    loggedIn: true,
                    username: "alice",
                    envOverride: false,
                    userCount: 1,
                }),
            );

            const result = await login("alice", "secret");
            expect(result.done).toBe(true);
            expect(result.done && result.status.username).toBe("alice");

            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith("/api/auth/login", {
                username: "alice",
                password: "secret",
            });
            // same origin: the HttpOnly cookie is enough, scripts must not see the token
            expect(sessionStorage.getItem("teddycloud_web_token")).toBeNull();
            expect(apiMock.apiGetTeddyCloudApiRaw).toHaveBeenCalledWith("/api/auth/status");
        });

        it("keeps the token when the API is on another origin (dev server)", async () => {
            vi.stubEnv("VITE_APP_TEDDYCLOUD_API_URL", "http://teddycloud.local:8080");
            setStoredToken("dev-token");
            expect(getStoredToken()).toBe("dev-token");
        });

        it("returns the challenge when a second factor is needed", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({
                    ok: false,
                    twoFactorRequired: true,
                    challenge: "c1",
                    methods: ["totp", "recovery"],
                }),
            );

            await expect(login("alice", "secret")).resolves.toEqual({
                done: false,
                challenge: "c1",
                methods: ["totp", "recovery"],
            });
            expect(apiMock.apiGetTeddyCloudApiRaw).not.toHaveBeenCalled();
        });

        it("sends a TOTP code or a recovery code for the second step", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockImplementation(async () =>
                jsonResponse({ ok: true, recoveryCodesLeft: 9 }),
            );
            apiMock.apiGetTeddyCloudApiRaw.mockImplementation(async () =>
                jsonResponse({ enabled: true, loggedIn: true }),
            );

            await expect(loginSecondFactor("c1", "123456", "totp")).resolves.toMatchObject({
                recoveryCodesLeft: 9,
            });
            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith("/api/auth/login2fa", {
                challenge: "c1",
                code: "123456",
            });
            await loginSecondFactor("c1", "ABCDE-FGHIJ", "recovery");
            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenLastCalledWith(
                "/api/auth/login2fa",
                {
                    challenge: "c1",
                    recoveryCode: "ABCDE-FGHIJ",
                },
            );
        });

        it("passes the retry time of a lockout", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ error: "rate_limited", retryAfter: 120 }, 429),
            );

            await expect(login("alice", "wrong")).rejects.toMatchObject({
                code: "rate_limited",
                retryAfter: 120,
            });
        });

        it("throws rate_limited for HTTP 429", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ message: "slow down" }, 429),
            );

            await expect(login("alice", "wrong")).rejects.toThrow("rate_limited");
        });

        it("throws rate_limited when the backend returns that error code", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ error: "rate_limited" }, 401),
            );

            await expect(login("alice", "wrong")).rejects.toThrow("rate_limited");
        });

        it("propagates the backend login error message", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ message: "invalid credentials" }, 401),
            );

            await expect(login("alice", "wrong")).rejects.toThrow("invalid credentials");
            expect(sessionStorage.getItem("teddycloud_web_token")).toBeNull();
        });
    });

    describe("logout", () => {
        it("clears the stored token after a successful logout", async () => {
            sessionStorage.setItem("teddycloud_web_token", "token");
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(new Response(null, { status: 200 }));

            await logout();

            expect(apiMock.apiGetTeddyCloudApiRaw).toHaveBeenCalledWith("/api/auth/logout");
            expect(sessionStorage.getItem("teddycloud_web_token")).toBeNull();
        });

        it("clears the stored token even when the logout request fails", async () => {
            sessionStorage.setItem("teddycloud_web_token", "token");
            apiMock.apiGetTeddyCloudApiRaw.mockRejectedValue(new Error("network down"));

            await expect(logout()).rejects.toThrow("network down");
            expect(sessionStorage.getItem("teddycloud_web_token")).toBeNull();
        });
    });

    describe("user administration", () => {
        it("loads users and normalizes an invalid users field", async () => {
            apiMock.apiGetTeddyCloudApiRaw.mockResolvedValue(
                jsonResponse({ users: "invalid", enabled: true, envOverride: false }),
            );

            await expect(fetchAuthUsers()).resolves.toEqual({
                users: [],
                userDetails: [],
                enabled: true,
                envOverride: false,
                require2faAll: false,
                maxUsers: 0,
                passwordMinLength: 10,
            });
        });

        it("creates a user with the expected payload", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(jsonResponse({}));

            await createAuthUser("bob", "secret");

            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith(
                "/api/auth/users/create",
                { username: "bob", password: "secret" },
            );
        });

        it("returns authDisabled when deleting the last user", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ authDisabled: true }),
            );

            await expect(deleteAuthUser("bob")).resolves.toEqual({ authDisabled: true });
            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith(
                "/api/auth/users/delete",
                { username: "bob" },
            );
        });

        it("sends the current password when changing the own password", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ sessionsRevoked: 2 }),
            );

            await expect(changeAuthPassword("bob", "new-secret", "old-secret")).resolves.toEqual({
                sessionsRevoked: 2,
            });

            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith(
                "/api/auth/users/updatePassword",
                { username: "bob", password: "new-secret", currentPassword: "old-secret" },
            );
        });

        it("tells a TOTP code from a recovery code when confirming", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockImplementation(async () =>
                jsonResponse({ recoveryCodes: ["A"] }),
            );

            await renewRecoveryCodes("pw", "123 456");
            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenLastCalledWith(
                "/api/auth/2fa/recoveryCodes",
                {
                    password: "pw",
                    code: "123456",
                },
            );
            await disableTwoFactor("pw", " abcde-fghij ");
            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenLastCalledWith(
                "/api/auth/2fa/disable",
                {
                    password: "pw",
                    recoveryCode: "abcde-fghij",
                },
            );
        });

        it("changes a password with the expected payload", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(jsonResponse({}));

            await changeAuthPassword("bob", "new-secret");

            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith(
                "/api/auth/users/updatePassword",
                { username: "bob", password: "new-secret" },
            );
        });

        it("updates the enabled state with the expected payload", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(jsonResponse({}));

            await setAuthEnabled(true);

            expect(apiMock.apiPostTeddyCloudJsonRaw).toHaveBeenCalledWith("/api/auth/enabled", {
                enabled: true,
            });
        });

        it("propagates user administration errors", async () => {
            apiMock.apiPostTeddyCloudJsonRaw.mockResolvedValue(
                jsonResponse({ message: "cannot create user" }, 400),
            );

            await expect(createAuthUser("bob", "x")).rejects.toThrow("cannot create user");
        });
    });
});
