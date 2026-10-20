import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { shrinkImage } from "../../../../utils/images/shrinkImage";
import { toLanguageCode } from "../../../common/icons/LanguageFlagIcon";
import type { CustomEntry } from "../../custommodel/types/customModelEditorTypes";
import {
    buildSuggestedModel,
    normalizeEntryFromApi,
} from "../../custommodel/utils/customModelEditorUtils";

const api = new TeddyCloudApi(defaultAPIConfig());

/** what the user gives along with the audio files for the custom model of the new TAF */
export interface CoverInfo {
    cover: File | null;
    series: string;
    episodes: string;
}

/** the chapter name of an uploaded or selected audio file */
export const trackTitle = (fileName: string) =>
    fileName
        .replace(/\.[^.]+$/, "")
        .replace(/^\d+\s*[-_.]\s*/, "")
        .trim() || fileName;

/** the language of the UI as a language code of the tonies ("de" -> "de-de") */
export const languageOf = (uiLanguage: string) => {
    const lang = uiLanguage.slice(0, 2).toLowerCase();
    return toLanguageCode(`${lang}-${lang === "en" ? "gb" : lang}`) || "";
};

/** a file name in custom_img that is free and safe */
export const coverFileName = (name: string, now = Date.now()) =>
    `${now.toString(36)}-${name.replace(/[^\w.-]+/g, "_")}`;

/** the TAF's audio id and hash; a playlist adds its own audio id (same hash), which shows its cover */
export interface TafHeader {
    audioId: number | string;
    sha1Hash: string;
    alsoAudioIds?: (number | string)[];
}

/** the custom model of a TAF: its audio id and hash, title, chapters and picture */
export function coverEntry(
    model: string,
    header: TafHeader,
    info: { series: string; episodes: string; tracks: string[]; language: string; pic: string },
): CustomEntry {
    const series = info.series.trim();
    const episodes = info.episodes.trim();
    const ids = [...new Set([header.audioId, ...(header.alsoAudioIds ?? [])].map(String))];
    return {
        model,
        audio_id: ids,
        hash: ids.map(() => header.sha1Hash),
        title: episodes ? `${series} - ${episodes}` : series,
        series,
        episodes: episodes || undefined,
        tracks: info.tracks.length > 0 ? info.tracks : undefined,
        language: info.language || undefined,
        pic: info.pic || undefined,
    };
}

/**
 * makes the custom model of a TAF just written to the library: the cover goes shrunk to
 * custom_img, the model gets the TAF's audio id and hash; returns the model id
 */
export async function saveCoverModel(
    dir: string,
    tafName: string,
    info: CoverInfo,
    tracks: string[],
    language: string,
    special = "library",
    known?: TafHeader,
): Promise<string> {
    let header: Partial<TafHeader> | undefined = known;
    if (!header) {
        const index = await api.apiGetTeddyCloudApiRaw(
            `/api/fileIndexV2?path=${encodeURIComponent(dir)}&special=${encodeURIComponent(special)}`,
        );
        const files: { name: string; tafHeader?: { audioId?: number; sha1Hash?: string } }[] =
            (await index.json()).files ?? [];
        header = files.find((f) => f.name === tafName)?.tafHeader;
    }
    if (!header?.audioId || !header.sha1Hash) throw new Error(`${tafName}: no TAF header`);

    let pic = "";
    if (info.cover) {
        const small = await shrinkImage(info.cover).catch(() => info.cover as File);
        const name = coverFileName(small.name);
        const form = new FormData();
        form.append("file", small, name);
        const response = await api.apiPostTeddyCloudFormDataRaw(
            "/api/fileUpload?path=&special=custom_img",
            form,
        );
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        pic = `/custom_img/${name}`;
    }

    const custom = await (await api.apiGetTeddyCloudApiRaw("/api/toniesCustomJson")).json();
    const model = buildSuggestedModel(
        Array.isArray(custom) ? custom.map((entry) => normalizeEntryFromApi(entry)) : [],
    );
    const entry = coverEntry(
        model,
        { audioId: header.audioId, sha1Hash: header.sha1Hash, alsoAudioIds: header.alsoAudioIds },
        { series: info.series, episodes: info.episodes, tracks, language, pic },
    );
    const response = await api.apiPostTeddyCloudRaw(
        "/api/toniesCustomJsonUpsert",
        JSON.stringify(entry),
        undefined,
        undefined,
        { "Content-Type": "application/json" },
    );
    if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
    return model;
}
