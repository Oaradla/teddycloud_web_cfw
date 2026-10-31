export async function fetchDownloadBlob(url: string): Promise<Blob> {
    const headers = new Headers();
    try {
        const token = sessionStorage.getItem("teddycloud_web_token");
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    } catch {
        /* ignore */
    }

    const response = await fetch(url, { credentials: "include", headers });
    if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
    }
    return response.blob();
}

export function saveBlob(blob: Blob, filename?: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

export async function triggerBrowserDownload(url: string, filename?: string): Promise<void> {
    saveBlob(await fetchDownloadBlob(url), filename);
}

export function toSameOriginUrl(url: string): string {
    if (!url) {
        return url;
    }
    if (url.startsWith("/")) {
        return url;
    }
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return url;
    }
}

export function buildTafDownloadUrl(
    contentUrl: string,
    options: {
        tracks?: number[];
        format?: "ogg" | "mp3";
    } = {},
): string {
    const relative = toSameOriginUrl(contentUrl);
    const parsed = new URL(relative, window.location.origin);
    parsed.searchParams.set("ogg", "true");
    parsed.searchParams.delete("tracks");
    parsed.searchParams.delete("filename");
    parsed.searchParams.delete("entry");
    parsed.searchParams.delete("format");
    if (options.format === "mp3") {
        parsed.searchParams.set("format", "mp3");
    }

    // Track titles stay out of the query. The server only accepts 255 characters,
    // and a multi-track name list exceeds that and is dropped as an empty reply.
    if (options.tracks && options.tracks.length > 0) {
        parsed.searchParams.set("tracks", options.tracks.join(","));
    }

    return parsed.pathname + parsed.search;
}
