import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { cardConfig, cc3200Releases, macOfCertificate, packageFiles } from "./cc3200Package";
import { CfwImage } from "../../../../../api/cfwApi";

const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe("cc3200Package", () => {
    it("writes the card config, the port only when it is not 443", () => {
        expect(text(cardConfig(" tc.local ", "443"))).toBe("host=tc.local\nca=c2.der\n");
        expect(text(cardConfig("tc.local", "10443"))).toBe(
            "host=tc.local\nport=10443\nca=c2.der\n",
        );
    });

    it("finds the box ID in the common name of the client certificate", () => {
        const cn = [..."b'aabbccddeeff'"].map((c) => c.charCodeAt(0));
        const der = new Uint8Array([0x30, 0x06, 0x03, 0x55, 0x04, 0x03, 0x0c, cn.length, ...cn, 0]);
        expect(macOfCertificate(der)).toBe("aabbccddeeff");
        expect(macOfCertificate(new Uint8Array(20))).toBe("");
    });

    it("lists only CC3200 images with a package, newest first", () => {
        const images = [
            { build: 1, package: true },
            { build: 3, package: true },
            { build: 2, package: false },
            { build: 4, package: true, platform: "esp32" },
        ] as CfwImage[];
        expect(cc3200Releases(images).map((i) => i.build)).toEqual([3, 1]);
    });

    it("takes the files below a prefix out of the package", async () => {
        const zip = new JSZip();
        zip.file("cc3200/card/revvox/boot/ngCfg.json", "{}");
        zip.file("cc3200/flash/sys/mcuimg.bin", new Uint8Array([1, 2]));
        const pkg = await zip.generateAsync({ type: "uint8array" });
        expect(Object.keys(await packageFiles(pkg, "cc3200/card/"))).toEqual([
            "revvox/boot/ngCfg.json",
        ]);
        expect([...(await packageFiles(pkg, "cc3200/flash/"))["sys/mcuimg.bin"]]).toEqual([1, 2]);
    });
});
