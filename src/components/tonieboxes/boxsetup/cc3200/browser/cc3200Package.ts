import JSZip from "jszip";

import { CfwImage } from "../../../../../api/cfwApi";

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

/** cfw/config.txt of the card: where the box finds teddyCloud */
export function cardConfig(host: string, port: string) {
    const lines = [`host=${host.trim()}`];
    if (port.trim() && port.trim() !== "443") lines.push(`port=${port.trim()}`);
    lines.push("ca=c2.der");
    return new TextEncoder().encode(lines.join("\n") + "\n");
}
