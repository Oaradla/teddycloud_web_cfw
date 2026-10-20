/**
 * Sensitive changes (users, login protection, security settings) need the password
 * again when the last confirmation is older than a few minutes. The server answers
 * 403 "reauth_required"; the AuthProvider registers a dialog that asks for the
 * password (and 2FA code), and the request is sent once more.
 */
type ReauthHandler = () => Promise<boolean>;

let handler: ReauthHandler | null = null;
let pending: Promise<boolean> | null = null;

export function registerReauthHandler(next: ReauthHandler | null): void {
    handler = next;
}

/** asks once for all requests that need the confirmation at the same time */
export function requestReauth(): Promise<boolean> {
    if (!handler) {
        return Promise.resolve(false);
    }
    if (!pending) {
        pending = handler().finally(() => {
            pending = null;
        });
    }
    return pending;
}

export async function isReauthRequired(response: Response): Promise<boolean> {
    if (response.status !== 403) {
        return false;
    }
    try {
        const data = await response.clone().json();
        return data?.error === "reauth_required";
    } catch {
        return false;
    }
}
