import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthStatus } from "../utils/auth/webAuthApi";
import { setUserStorageScope } from "../utils/storage/userStorage";
import { ReauthModal } from "../components/settings/webauth/ReauthModal";
import {
    fetchAuthStatus,
    login as apiLogin,
    loginSecondFactor as apiLoginSecondFactor,
    logout as apiLogout,
    setStoredToken,
} from "../utils/auth/webAuthApi";

/** A second factor is needed to finish the login. */
export type PendingSecondFactor = { challenge: string; methods: string[] };

type AuthContextValue = AuthStatus & {
    loading: boolean;
    error: string | null;
    statusAvailable: boolean;
    needsLogin: boolean;
    needsTwoFactorSetup: boolean;
    needsPasswordChange: boolean;
    refresh: () => Promise<void>;
    /** resolves with the pending second factor, or null when the login is complete */
    login: (username: string, password: string) => Promise<PendingSecondFactor | null>;
    loginSecondFactor: (
        challenge: string,
        value: string,
        method: "totp" | "recovery",
    ) => Promise<{ recoveryCodesLeft?: number }>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const emptyStatus: AuthStatus = {
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
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatusState] = useState<AuthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // GUI settings are stored per user, so the scope must be switched before the UI reads them.
    const setStatus = useCallback((next: AuthStatus) => {
        setUserStorageScope(
            next.enabled && (next.loggedIn || next.twoFactorSetupRequired) ? next.username : "",
        );
        setStatusState(next);
    }, []);

    const refresh = useCallback(async () => {
        setError(null);

        try {
            const next = await fetchAuthStatus();

            setStatus(next);

            if (!next.loggedIn && !next.twoFactorSetupRequired) {
                setStoredToken(null);
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Could not load authentication status";

            setError(message);
            throw err;
        }
    }, [setStatus]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const next = await fetchAuthStatus();

                if (!cancelled) {
                    setStatus(next);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error ? err.message : "Could not load authentication status",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onAuthRequired = () => {
            setUserStorageScope("");
            // A 401 proves that login is enabled, even if it was disabled when the UI was loaded.
            setStatusState((current) =>
                current ? { ...current, enabled: true, loggedIn: false, username: "" } : current,
            );
            setStoredToken(null);
        };
        window.addEventListener("teddycloud-auth-required", onAuthRequired);
        return () => window.removeEventListener("teddycloud-auth-required", onAuthRequired);
    }, []);

    const login = useCallback(
        async (username: string, password: string) => {
            const result = await apiLogin(username, password);
            if (!result.done) {
                return { challenge: result.challenge, methods: result.methods };
            }
            setStatus(result.status);
            return null;
        },
        [setStatus],
    );

    const loginSecondFactor = useCallback(
        async (challenge: string, value: string, method: "totp" | "recovery") => {
            const result = await apiLoginSecondFactor(challenge, value, method);
            setStatus(result.status);
            return { recoveryCodesLeft: result.recoveryCodesLeft };
        },
        [setStatus],
    );

    const logout = useCallback(async () => {
        try {
            await apiLogout();
        } catch {
            // The token is removed locally either way.
        }

        try {
            await refresh();
        } catch {
            // Without a reachable API the old "logged in" status must not stay on screen.
            setUserStorageScope("");
            setStatusState(null);
        }
    }, [refresh]);

    const value = useMemo<AuthContextValue>(
        () => ({
            ...(status ?? emptyStatus),
            loading,
            error,
            statusAvailable: status !== null,
            needsLogin: Boolean(
                status?.enabled && !status.loggedIn && !status.twoFactorSetupRequired,
            ),
            needsTwoFactorSetup: Boolean(status?.enabled && status.twoFactorSetupRequired),
            needsPasswordChange: Boolean(
                status?.enabled && status.loggedIn && status.passwordChangeRequired,
            ),
            refresh,
            login,
            loginSecondFactor,
            logout,
        }),
        [status, loading, error, refresh, login, loginSecondFactor, logout],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
            {status?.enabled && status.loggedIn && !status.passwordChangeRequired ? (
                <ReauthModal twoFactor={status.twoFactorEnabled} />
            ) : null}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
