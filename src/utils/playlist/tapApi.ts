import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";

const api = new TeddyCloudApi(defaultAPIConfig());

export interface TapBuildResult {
    /** the playlist TAF is up to date */
    built: boolean;
    /** all files are TAFs, so the playlist TAF is put together without encoding */
    remux: boolean;
    filepath?: string;
    error?: string;
}

export interface TafSplitResult {
    /** library paths, without a leading slash */
    folder: string;
    tap: string;
    chapters: number;
}

const libraryPath = (path: string) => path.replace(/^\/+/, "");

const post = async <T>(endpoint: string, body: string): Promise<T> => {
    const response = await api.apiPostTeddyCloudRaw(endpoint, body);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `${response.status} ${response.statusText}`);
    }
    return data as T;
};

/** puts the TAF of a playlist (path in the library) together again */
export const buildTap = (tapPath: string) =>
    post<TapBuildResult>(
        "/api/tapBuild?special=library",
        `path=${encodeURIComponent(libraryPath(tapPath))}`,
    );

/**
 * Writes every chapter of a TAF (path in the library) as a TAF of its own into a folder next
 * to it and creates a playlist there that puts them together into the original TAF again.
 */
export const splitTafToPlaylist = (tafPath: string, titles: string[] = []) =>
    post<TafSplitResult>(
        "/api/tafSplit?special=library",
        [`path=${encodeURIComponent(libraryPath(tafPath))}`]
            .concat(titles.map((title) => `title=${encodeURIComponent(title)}`))
            .join("&"),
    );
