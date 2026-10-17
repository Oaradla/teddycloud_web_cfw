import { describe, expect, it } from "vitest";

import { CfwBox, CfwImage } from "../../../api/cfwApi";
import { channelKey, esp32Installs, imagesForBox, pageOffered, platformOf } from "./channels";

const image = (build: number, platform?: "cc3200" | "esp32") =>
    ({ build, platform, channel: "beta", version: "", revision: "" }) as CfwImage;

const box = (fields: Partial<CfwBox>) =>
    ({
        isCfw: false,
        update: {
            enabled: true,
            channel: "none",
            mode: "manual",
            target: 0,
            allowRolledBack: false,
            next: 0,
        },
        ...fields,
    }) as CfwBox;

describe("platforms", () => {
    it("takes a missing platform as cc3200", () => {
        expect(platformOf({})).toBe("cc3200");
        expect(platformOf({ platform: "esp32" })).toBe("esp32");
    });

    it("offers a box only the images of its platform", () => {
        const images = [image(1), image(2, "esp32"), image(3, "cc3200")];
        expect(imagesForBox(images, box({ platform: "esp32" })).map((i) => i.build)).toEqual([2]);
        expect(imagesForBox(images, box({})).map((i) => i.build)).toEqual([1, 3]);
    });

    it("offers the original ESP32 firmware only to a box running the custom firmware", () => {
        const original = { ...image(4, "esp32"), original: true, channel: "none" } as CfwImage;
        const images = [image(2, "esp32"), original];
        expect(
            imagesForBox(images, box({ platform: "esp32", isCfw: true })).map((i) => i.build),
        ).toEqual([2, 4]);
        expect(imagesForBox(images, box({ platform: "esp32" })).map((i) => i.build)).toEqual([2]);
        expect(channelKey(original)).toBe("cfw.update.original");
        expect(channelKey(image(2, "esp32"))).toBe("cfw.channel.beta");
    });

    it("shows a pending first installation on an ESP32 box with the original firmware", () => {
        const assigned = (target: number, delivered: number, isCfw = false) =>
            box({
                platform: "esp32",
                isCfw,
                esp32Delivered: delivered,
                update: {
                    enabled: true,
                    channel: "none",
                    mode: "manual",
                    target,
                    allowRolledBack: false,
                    next: 0,
                },
            });
        expect(esp32Installs(assigned(5, 0))).toBe(true);
        expect(esp32Installs(assigned(5, 5))).toBe(false);
        expect(esp32Installs(assigned(0, 0))).toBe(false);
        expect(esp32Installs(assigned(5, 0, true))).toBe(false);
    });
});

describe("setup page of a release", () => {
    it("is offered when the image brings another page than the box has", () => {
        const withPage = { ...image(5), page: 111 } as CfwImage;
        expect(pageOffered(box({ pageVersion: 222 }), withPage)).toBe(true);
        expect(pageOffered(box({}), withPage)).toBe(true);
        expect(pageOffered(box({ pageVersion: 111 }), withPage)).toBe(false);
        expect(pageOffered(box({ pageVersion: 111 }), image(6))).toBe(false);
        expect(pageOffered(box({ pageVersion: 111 }), undefined)).toBe(false);
    });
});
