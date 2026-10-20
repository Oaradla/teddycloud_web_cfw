import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";

const api = new TeddyCloudApi(defaultAPIConfig());

const TOKEN_KEY = "teddycloud_web_token";

export type AuthClientInfo = {
    ip: string;
    lan: boolean;
    secure: boolean;
    viaTrustedProxy: boolean;
    forwardedForIgnored?: boolean;
};

export type AuthStatus = {
    enabled: boolean;
    loggedIn: boolean;
    username: string;
    envOverride: boolean;
    userCount: number;
    twoFactorSetupRequired: boolean;
    /** an admin demands a new password; until then the server answers nothing else */
    passwordChangeRequired: boolean;
    twoFactorEnabled: boolean;
    twoFactorRequired: boolean;
    recoveryCodesLeft: number;
    passwordMinLength: number;
    client?: AuthClientInfo;
};

export type AuthUser = {
    username: string;
    level?: "admin" | "user" | "guest";
    /** own group, empty for the built-in group of the level */
    group?: string;
    deny?: string;
    createdBy?: string;
    twoFactor: boolean;
    require2fa: boolean;
    mustChangePassword?: boolean;
    lanOnly: boolean;
    recoveryCodesLeft: number;
    created: number;
    passwordChanged: number;
    lastLogin: number;
    legacyHash: boolean;
};

export type AuthUsersResponse = {
    users: string[];
    userDetails: AuthUser[];
    enabled: boolean;
    envOverride: boolean;
    require2faAll: boolean;
    maxUsers: number;
    passwordMinLength: number;
};

export type AuthSession = {
    id: string;
    username: string;
    created: number;
    lastSeen: number;
    expires: number;
    ip: string;
    userAgent: string;
    current: boolean;
    twoFactorSetupPending: boolean;
};

export type AuthEvent = {
    time: number;
    type: string;
    username: string;
    ip: string;
    detail: string;
};

export type AuthEventsResponse = {
    events: AuthEvent[];
    lockedAddresses: { ip: string; lockedUntil: number }[];
};

/** Result of the password step: either logged in, or a second factor is needed. */
export type LoginResult =
    { done: true; status: AuthStatus } | { done: false; challenge: string; methods: string[] };

export type TwoFactorSetup = {
    secret: string;
    otpauthUri: string;
    expiresIn: number;
};

/** Error with the server's error code (e.g. "rate_limited", "wrong_password"). */
export class AuthApiError extends Error {
    code: string;
    status: number;
    retryAfter?: number;

    constructor(message: string, code: string, status: number, retryAfter?: number) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

/**
 * The server sets an HttpOnly session cookie, which is all a same-origin UI needs. Only a UI
 * served from another origin (dev server with VITE_APP_TEDDYCLOUD_API_URL) can not use the
 * cookie and keeps the bearer token, where page scripts could read it.
 */
function usesBearerToken(): boolean {
    const envUrl = String(import.meta.env.VITE_APP_TEDDYCLOUD_API_URL ?? "").trim();
    if (!envUrl || typeof window === "undefined") {
        return false;
    }
    try {
        return new URL(envUrl, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}

export function getStoredToken(): string | null {
    try {
        return sessionStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setStoredToken(token: string | null): void {
    try {
        if (token && usesBearerToken()) {
            sessionStorage.setItem(TOKEN_KEY, token);
        } else {
            sessionStorage.removeItem(TOKEN_KEY);
        }
    } catch {
        /* ignore */
    }
}

async function parseJson(response: Response): Promise<any> {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

async function post(path: string, body: unknown, fallback: string): Promise<any> {
    const response = await api.apiPostTeddyCloudJsonRaw(path, body);
    const data = await parseJson(response);
    if (!response.ok) {
        throw new AuthApiError(
            data.message || fallback,
            data.error || "failed",
            response.status,
            data.retryAfter,
        );
    }
    return data;
}

async function get(path: string, fallback: string): Promise<any> {
    const response = await api.apiGetTeddyCloudApiRaw(path);
    const data = await parseJson(response);
    if (!response.ok) {
        throw new AuthApiError(data.message || fallback, data.error || "failed", response.status);
    }
    return data;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
    const response = await api.apiGetTeddyCloudApiRaw("/api/auth/status");
    const data = await parseJson(response);

    if (!response.ok) {
        throw new Error(
            data.message || `Could not load authentication status (HTTP ${response.status})`,
        );
    }

    if (typeof data.enabled !== "boolean" || typeof data.loggedIn !== "boolean") {
        throw new Error("Invalid authentication status response");
    }

    return {
        enabled: data.enabled,
        loggedIn: data.loggedIn,
        username: data.username || "",
        envOverride: !!data.envOverride,
        userCount: Number(data.userCount || 0),
        twoFactorSetupRequired: !!data.twoFactorSetupRequired,
        passwordChangeRequired: !!data.passwordChangeRequired,
        twoFactorEnabled: !!data.twoFactorEnabled,
        twoFactorRequired: !!data.twoFactorRequired,
        recoveryCodesLeft: Number(data.recoveryCodesLeft || 0),
        passwordMinLength: Number(data.passwordMinLength || 10),
        client: data.client,
    };
}

function loginError(response: Response, data: any): AuthApiError {
    if (response.status === 429 || data.error === "rate_limited") {
        return new AuthApiError("rate_limited", "rate_limited", response.status, data.retryAfter);
    }
    return new AuthApiError(
        data.message || "Login failed",
        data.error || "failed",
        response.status,
    );
}

export async function login(username: string, password: string): Promise<LoginResult> {
    const response = await api.apiPostTeddyCloudJsonRaw("/api/auth/login", {
        username,
        password,
        ...(usesBearerToken() ? { wantToken: true } : {}),
    });

    const data = await parseJson(response);

    if (!response.ok) {
        throw loginError(response, data);
    }

    if (data.twoFactorRequired) {
        return {
            done: false,
            challenge: String(data.challenge || ""),
            methods: Array.isArray(data.methods) ? data.methods : ["totp"],
        };
    }

    if (data.token) {
        setStoredToken(data.token);
    }

    return { done: true, status: await fetchAuthStatus() };
}

export async function loginSecondFactor(
    challenge: string,
    value: string,
    method: "totp" | "recovery",
): Promise<{ status: AuthStatus; recoveryCodesLeft?: number }> {
    const body = {
        challenge,
        ...(method === "totp" ? { code: value } : { recoveryCode: value }),
        ...(usesBearerToken() ? { wantToken: true } : {}),
    };
    const response = await api.apiPostTeddyCloudJsonRaw("/api/auth/login2fa", body);
    const data = await parseJson(response);

    if (!response.ok) {
        throw loginError(response, data);
    }

    if (data.token) {
        setStoredToken(data.token);
    }

    return { status: await fetchAuthStatus(), recoveryCodesLeft: data.recoveryCodesLeft };
}

export async function logout(): Promise<void> {
    try {
        await api.apiGetTeddyCloudApiRaw("/api/auth/logout");
    } finally {
        setStoredToken(null);
    }
}

export async function fetchAuthUsers(): Promise<AuthUsersResponse> {
    const data = await get("/api/auth/users/get", "Could not load users");
    const names: string[] = Array.isArray(data.users) ? data.users : [];
    const details: AuthUser[] = Array.isArray(data.userDetails)
        ? data.userDetails
        : names.map((username) => ({
              username,
              twoFactor: false,
              require2fa: false,
              lanOnly: false,
              recoveryCodesLeft: 0,
              created: 0,
              passwordChanged: 0,
              lastLogin: 0,
              legacyHash: false,
          }));

    return {
        users: names,
        userDetails: details,
        enabled: !!data.enabled,
        envOverride: !!data.envOverride,
        require2faAll: !!data.require2faAll,
        maxUsers: Number(data.maxUsers || 0),
        passwordMinLength: Number(data.passwordMinLength || 10),
    };
}

export async function createAuthUser(
    username: string,
    password: string,
    options: {
        lanOnly?: boolean;
        require2fa?: boolean;
        mustChangePassword?: boolean;
        level?: string;
        group?: string;
    } = {},
): Promise<void> {
    await post(
        "/api/auth/users/create",
        { username, password, ...options },
        "Could not create user",
    );
}

export async function updateAuthUser(
    username: string,
    changes: {
        lanOnly?: boolean;
        require2fa?: boolean;
        mustChangePassword?: boolean;
        reset2fa?: boolean;
        revokeSessions?: boolean;
        level?: string;
        group?: string;
        deny?: string;
    },
): Promise<{ user: AuthUser; sessionsRevoked: number }> {
    const data = await post(
        "/api/auth/users/update",
        { username, ...changes },
        "Could not update user",
    );
    return { user: data.user, sessionsRevoked: Number(data.sessionsRevoked || 0) };
}

export async function deleteAuthUser(username: string): Promise<{ authDisabled: boolean }> {
    const data = await post("/api/auth/users/delete", { username }, "Could not delete user");

    return {
        authDisabled: !!data.authDisabled,
    };
}

/**
 * currentPassword is needed when changing the own password; mustChangePassword
 * makes another user choose a new one at the next login.
 */
export async function changeAuthPassword(
    username: string,
    password: string,
    currentPassword?: string,
    mustChangePassword?: boolean,
): Promise<{ sessionsRevoked: number }> {
    const body: Record<string, string | boolean> = { username, password };
    if (currentPassword !== undefined) {
        body.currentPassword = currentPassword;
    }
    if (mustChangePassword) {
        body.mustChangePassword = true;
    }
    const data = await post("/api/auth/users/updatePassword", body, "Could not change password");
    return { sessionsRevoked: Number(data.sessionsRevoked || 0) };
}

export async function setAuthEnabled(enabled: boolean): Promise<void> {
    await post("/api/auth/enabled", { enabled }, "Could not update login setting");
}

export async function startTwoFactorSetup(password: string): Promise<TwoFactorSetup> {
    const data = await post("/api/auth/2fa/setup", { password }, "Could not start the setup");
    return {
        secret: String(data.secret || ""),
        otpauthUri: String(data.otpauthUri || ""),
        expiresIn: Number(data.expiresIn || 0),
    };
}

export async function enableTwoFactor(code: string): Promise<string[]> {
    const data = await post(
        "/api/auth/2fa/enable",
        { code },
        "Could not enable two-factor authentication",
    );
    return Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
}

export async function disableTwoFactor(password: string, code: string): Promise<void> {
    await post(
        "/api/auth/2fa/disable",
        codeBody(password, code),
        "Could not disable two-factor authentication",
    );
}

export async function renewRecoveryCodes(password: string, code: string): Promise<string[]> {
    const data = await post(
        "/api/auth/2fa/recoveryCodes",
        codeBody(password, code),
        "Could not create recovery codes",
    );
    return Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
}

/** a 6 digit value is a TOTP code, anything else a recovery code */
function codeBody(password: string, code: string): Record<string, string> {
    const trimmed = code.replace(/\s/g, "");
    return /^\d{6}$/.test(trimmed)
        ? { password, code: trimmed }
        : { password, recoveryCode: code.trim() };
}

export async function fetchSessions(all = false): Promise<AuthSession[]> {
    const data = await get(
        `/api/auth/sessions/get${all ? "?all=1" : ""}`,
        "Could not load sessions",
    );
    return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function revokeSession(id: string): Promise<number> {
    const data = await post("/api/auth/sessions/revoke", { id }, "Could not end the session");
    return Number(data.revoked || 0);
}

export async function revokeOtherSessions(): Promise<number> {
    const data = await post(
        "/api/auth/sessions/revoke",
        { others: true },
        "Could not end the sessions",
    );
    return Number(data.revoked || 0);
}

export async function fetchAuthEvents(): Promise<AuthEventsResponse> {
    const data = await get("/api/auth/events/get", "Could not load security events");
    return {
        events: Array.isArray(data.events) ? data.events : [],
        lockedAddresses: Array.isArray(data.lockedAddresses) ? data.lockedAddresses : [],
    };
}

export async function unlockLogin(target: { ip?: string; username?: string }): Promise<void> {
    await post("/api/auth/unlock", target, "Could not unlock");
}

/** confirms the password (and 2FA code) for sensitive changes in the next minutes */
export async function confirmIdentity(password: string, code?: string): Promise<void> {
    const body = code && code.trim() ? codeBody(password, code) : { password };
    await post("/api/auth/confirm", body, "Could not confirm");
}
