// Audio files into the library the fast way: every file is encoded as a TAF of its own (in
// parallel, in the browser or on the server) and teddyCloud joins them without re-encoding.
//   one TAF:   the parts go to a scratch folder, are joined into <folder>/<name>.taf and removed
//   playlist:  <folder>/<name>/NN - title.taf for every file plus <name>.tap there; the playlist
//              puts its TAF together next to itself as <name>.tap.taf (hidden in the library)
// Needs a teddyCloud with /api/tapBuild; hasTapBuild() tells.
import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { buildTap } from "../playlist/tapApi";
import { encodeFilesParallel } from "./encodePool";
import { toPcmSamples } from "./pcmSamples";

const api = new TeddyCloudApi(defaultAPIConfig());

export type Encoder = "browser" | "server";

export interface PartsJob {
    files: File[];
    /** chapter names, one per file */
    titles: string[];
    /** the TAF (one TAF) or the folder and playlist (playlist), without extension */
    name: string;
    /** library folder */
    folder: string;
    playlist: boolean;
    encoder: Encoder;
    bitrate: number;
}

export interface PartsResult {
    /** what a tonie plays: the TAF, or the playlist */
    source: string;
    /** the folder the result is in */
    folder: string;
    /** file name of the TAF in that folder */
    tafName: string;
    /** the TAF's header (the TAF of a playlist is not in the file lists) */
    header?: { audioId: number; sha1Hash: string };
    /** the playlist's own audio id, which shows its cover */
    tapAudioId?: number;
}

/** progress: what happens, and how far all of it is (0..1) */
export type Step = (step: PartsStep, fraction: number) => void;
export type PartsStep =
    | { kind: "encoding"; done: number; total: number }
    | { kind: "uploading"; done: number; total: number }
    | { kind: "serverEncoding"; done: number; total: number }
    | { kind: "joining" };

const pad = (n: number) => String(n).padStart(2, "0");
const safe = (s: string) =>
    s
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/[. ]+$/g, "")
        .trim() || "Track";
const join = (dir: string, name: string) => `${dir.replace(/\/+$/, "")}/${name}`;
const lib = (path: string) => "lib://" + path.replace(/^\/+/, "");
const audioIdNow = () => Math.floor(Date.now() / 1000) - 0x50000000;
const query = (params: Record<string, string | number>) =>
    Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&");

const check = async (response: Response) => {
    if (!response.ok)
        throw new Error((await response.text().catch(() => "")) || `HTTP ${response.status}`);
    return response;
};

let tapBuildProbe: Promise<boolean> | null = null;
/** whether the server joins TAFs (an empty request answers 400 there, 404 elsewhere) */
export const hasTapBuild = () =>
    (tapBuildProbe ??= api
        .apiPostTeddyCloudRaw("/api/tapBuild?special=library", "")
        .then((r) => r.status !== 404 && r.status !== 405)
        .catch(() => false));

const dirCreate = (path: string) =>
    api.apiPostTeddyCloudRaw("/api/dirCreate?special=library", path).catch(() => undefined);

const fileDelete = (path: string) =>
    api.apiPostTeddyCloudRaw("/api/fileDelete?special=library", path).catch(() => undefined);

const tafUpload = async (taf: Blob, name: string, path: string) => {
    const form = new FormData();
    form.append("file", taf, name);
    await check(
        await api.apiPostTeddyCloudFormDataRaw(
            `/api/tafUpload?${query({ name, path, special: "library" })}`,
            form,
        ),
    );
};

const pcmUpload = async (
    pcm: Int16Array,
    title: string,
    name: string,
    path: string,
    audioId: number,
) => {
    const form = new FormData();
    form.append(
        title,
        new Blob([pcm.buffer as ArrayBuffer], { type: "audio/pcm" }),
        "pcmData.0.pcm",
    );
    await check(
        await api.apiPostTeddyCloudFormDataRaw(
            `/api/pcmUpload?${query({ name, audioId, path, special: "library" })}`,
            form,
        ),
    );
};

const saveTap = async (
    dir: string,
    fileName: string,
    out: string,
    name: string,
    files: { path: string; title: string }[],
) => {
    const tap = {
        type: "tap",
        audio_id: Math.floor(Date.now() / 1000),
        filepath: lib(out),
        name,
        files: files.map((f) => ({ filepath: lib(f.path), name: f.title })),
    };
    const form = new FormData();
    form.append(
        fileName,
        new File([JSON.stringify(tap, null, 2)], fileName, { type: "application/json" }),
    );
    await check(
        await api.apiPostTeddyCloudFormDataRaw(
            `/api/fileUpload?${query({ path: dir, special: "library" })}`,
            form,
        ),
    );
    return { path: join(dir, fileName), audioId: tap.audio_id };
};

/** runs fn for every item, at most limit at the same time */
async function limited<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** encodes the files as single TAFs into dir, named partName(i) */
async function makeParts(job: PartsJob, dir: string, partName: (i: number) => string, step: Step) {
    const total = job.files.length;
    const baseId = audioIdNow();
    if (job.encoder === "browser") {
        const parts = await encodeFilesParallel(job.files, baseId, job.bitrate, (f, done) =>
            step({ kind: "encoding", done, total }, f * 0.8),
        );
        let up = 0;
        await limited(parts, 3, async (taf, i) => {
            await tafUpload(taf, partName(i), dir);
            up++;
            step({ kind: "uploading", done: up, total }, 0.8 + (up / total) * 0.15);
        });
    } else {
        // the server encodes; it handles a few files at the same time
        let up = 0;
        step({ kind: "serverEncoding", done: 0, total }, 0.02);
        await limited(job.files, 2, async (file, i) => {
            const pcm = await toPcmSamples(file);
            await pcmUpload(pcm, job.titles[i], partName(i), dir, baseId - i);
            up++;
            step({ kind: "serverEncoding", done: up, total }, (up / total) * 0.95);
        });
    }
}

export async function uploadInParts(job: PartsJob, step: Step): Promise<PartsResult> {
    const name = safe(job.name);
    const n = job.files.length;

    if (job.playlist) {
        const dir = join(job.folder, name);
        await dirCreate(dir);
        const partName = (i: number) => `${pad(i + 1)} - ${safe(job.titles[i])}.taf`;
        await makeParts(job, dir, partName, step);
        const tafName = `${name}.tap.taf`;
        const tap = await saveTap(
            dir,
            `${name}.tap`,
            join(dir, tafName),
            job.name.trim(),
            job.files.map((_, i) => ({ path: join(dir, partName(i)), title: job.titles[i] })),
        );
        step({ kind: "joining" }, 0.97);
        const built = await buildTap(tap.path);
        if (!built.built) throw new Error(built.error || "the playlist could not be put together");
        return {
            source: tap.path,
            folder: dir,
            tafName,
            header: built.tafHeader,
            tapAudioId: tap.audioId,
        };
    }

    // parts in a scratch folder, joined into the target, then removed
    const tmp = join(job.folder, `_upload-${Date.now().toString(36)}`);
    await dirCreate(tmp);
    const partName = (i: number) => `${pad(i + 1)}.taf`;
    const tafName = `${name}.taf`;
    try {
        await makeParts(job, tmp, partName, step);
        const tap = await saveTap(
            tmp,
            "parts.tap",
            join(job.folder, tafName),
            job.name.trim(),
            job.files.map((_, i) => ({ path: join(tmp, partName(i)), title: job.titles[i] })),
        );
        step({ kind: "joining" }, 0.97);
        const built = await buildTap(tap.path);
        if (!built.built) throw new Error(built.error || "the parts could not be joined");
    } finally {
        for (let i = 0; i < n; i++) await fileDelete(join(tmp, partName(i)));
        await fileDelete(join(tmp, "parts.tap"));
        await fileDelete(tmp);
    }
    return { source: join(job.folder, tafName), folder: job.folder, tafName };
}
