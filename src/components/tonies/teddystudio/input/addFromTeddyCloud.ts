import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { TonieInfo } from "../../../../types/tonieTypes";
import type { BulkAddDataset } from "./BulkAddToniesModal";

const api = new TeddyCloudApi(defaultAPIConfig());

/** a label of the print sheet from what teddyCloud knows about a tonie or file */
export const datasetOf = (info: TonieInfo): BulkAddDataset => ({
    custom: false,
    text: info.series ?? "",
    series: info.series ?? "",
    episodes: info.episode ?? "",
    model: info.model ?? "",
    language: info.language ?? "",
    pic: info.picture || undefined,
    trackTitles: Array.isArray(info.tracks) ? info.tracks : [],
});

const datasetKey = (d: { model?: string; text?: string; series?: string; episodes?: string }) =>
    d.model || `${d.text ?? d.series ?? ""}|${d.episodes ?? ""}`;

/**
 * the datasets not on the sheet yet, one per model (or per title without one); infos without a
 * title are left out
 */
export function freshDatasets(
    infos: TonieInfo[],
    onSheet: { model?: string; text?: string; episodes?: string }[],
) {
    const known = new Set(onSheet.map(datasetKey));
    const out: BulkAddDataset[] = [];
    for (const info of infos) {
        if (!info || !(info.series || info.episode)) continue;
        const dataset = datasetOf(info);
        const key = datasetKey(dataset);
        if (known.has(key)) continue;
        known.add(key);
        out.push(dataset);
    }
    return out;
}

/** the tonies of all boxes (and those without a box), without system tags and hidden ones */
export async function myTonieInfos(): Promise<TonieInfo[]> {
    const boxes = await api.apiGetTonieboxesIndex().catch(() => []);
    const lists = await Promise.all([
        ...boxes.map((box) => api.apiGetTagIndex(box.ID).catch(() => [])),
        api.apiGetTagIndex().catch(() => []),
    ]);
    const byRuid = new Map<string, (typeof lists)[number][number]>();
    for (const tag of lists.flat()) if (!byRuid.has(tag.ruid)) byRuid.set(tag.ruid, tag);
    return [...byRuid.values()]
        .filter((tag) => tag.type !== "system" && !tag.hide)
        .map((tag) => tag.tonieInfo);
}

interface FileEntry {
    name: string;
    isDir: boolean;
    hide?: boolean;
    tonieInfo?: TonieInfo;
}

/** every TAF and playlist with a title in a library folder and the folders below, hidden ones left out */
export async function folderTonieInfos(path: string): Promise<TonieInfo[]> {
    const response = await api.apiGetTeddyCloudApiRaw(
        `/api/fileIndexV2?path=${encodeURIComponent(path)}&special=library`,
    );
    const files: FileEntry[] = (await response.json()).files ?? [];
    const out: TonieInfo[] = [];
    for (const f of files) {
        if (f.name === "." || f.name === ".." || f.hide) continue;
        if (f.isDir) out.push(...(await folderTonieInfos(`${path.replace(/\/$/, "")}/${f.name}`)));
        else if (/\.(taf|tap)$/i.test(f.name) && f.tonieInfo) out.push(f.tonieInfo);
    }
    return out;
}
