import JSZip from "jszip";

import { CfwImage } from "../../../../../api/cfwApi";
import { equal } from "./protocol";

/** the files of a release package below prefix, without it */
export async function packageFiles(pkg: Uint8Array, prefix: string) {
    const zip = await JSZip.loadAsync(pkg);
    const out: Record<string, Uint8Array> = {};
    for (const entry of Object.values(zip.files)) {
        if (entry.dir || !entry.name.startsWith(prefix)) continue;
        out[entry.name.slice(prefix.length)] = await entry.async("uint8array");
    }
    return out;
}

/** a zip of the files, stored without compression, offered as a download */
export async function saveZip(files: Record<string, Uint8Array>, name: string) {
    const zip = new JSZip();
    for (const [path, data] of Object.entries(files)) zip.file(path, data);
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** the CC3200 release packages of the library, newest first */
export const cc3200Releases = (images: CfwImage[] = []) =>
    images.filter((i) => i.package && i.platform !== "esp32").sort((a, b) => b.build - a.build);

/** the 12 hex digits of the box ID in the common name of its client certificate */
export function macOfCertificate(der: Uint8Array): string {
    for (let i = 0; i + 7 < der.length; i++) {
        // OID 2.5.4.3 (common name), then a string
        if (
            der[i] === 0x06 &&
            der[i + 1] === 0x03 &&
            der[i + 2] === 0x55 &&
            der[i + 3] === 0x04 &&
            der[i + 4] === 0x03
        ) {
            const length = der[i + 6];
            const cn = String.fromCharCode(...der.subarray(i + 7, i + 7 + length));
            const hex = cn.match(/[0-9a-fA-F]{12}/);
            if (hex) return hex[0].toLowerCase();
        }
    }
    return "";
}

/** the host name or IP of an input, also of a pasted address like "https://teddycloud.local/" */
export const hostOnly = (input: string) =>
    input
        .trim()
        .replace(/^[a-z]+:\/\//i, "")
        .replace(/[/:].*$/, "")
        .replace(/[^a-zA-Z0-9.-]/g, "");

/** cfw/config.txt of the card: where the box finds teddyCloud */
export function cardConfig(host: string, port: string) {
    const lines = [`host=${host.trim()}`];
    if (port.trim() && port.trim() !== "443") lines.push(`port=${port.trim()}`);
    lines.push("ca=c2.der");
    return new TextEncoder().encode(lines.join("\n") + "\n");
}

/** a HackieboxNG preloader names the SD bootloader it starts; the box's original bootloader does not */
export const isPreloader = (image: Uint8Array) =>
    new TextDecoder("latin1").decode(image).includes("/revvox/boot/ngbootloader.bin");

/** on the box while the preloader is written: /sys/mcuimg.bin is then no original */
export const PRELOADER_PENDING = "/sys/cfw-preloader.pending";

/**
 * What the bootloader step does with /sys/mcuimg.bin (current) and /sys/pre-img.bin (moved): move
 * the original to pre-img.bin first, or only write the preloader, or nothing; an error key otherwise.
 */
export function bootloaderPlan(
    current: Uint8Array | undefined,
    moved: Uint8Array | undefined,
    pending: boolean,
    preloader: Uint8Array,
): "move" | "write" | "upToDate" | "noMcuimg" | "noOriginal" {
    const original = !!moved && !isPreloader(moved);
    // an earlier run broke off: mcuimg.bin may be a fragment, the original is in pre-img.bin
    if (pending) return original ? "write" : "noOriginal";
    if (!current) return original ? "write" : "noMcuimg";
    if (isPreloader(current)) return equal(current, preloader) ? "upToDate" : "write";
    return "move";
}
