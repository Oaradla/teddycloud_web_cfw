import { describe, expect, it } from "vitest";
import { TFunction } from "i18next";

import en from "../../../public/translations/en.json";
import { CFW_MESSAGE_KEYS, cfwMessage } from "./cfwMessages";

const t = ((key: string) =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en) ??
    key) as TFunction;

describe("cfwMessage", () => {
    it("translates a known server message", () => {
        expect(cfwMessage(t, "box not found")).toBe("Box not found");
        expect(cfwMessage(t, "assigned; the box takes it at its next start")).toBe(
            "Assigned; the box takes it at its next start",
        );
    });

    it("keeps any other message as sent", () => {
        expect(cfwMessage(t, "speakerLimit must be 0 to 15")).toBe("speakerLimit must be 0 to 15");
    });

    it("has an English text for every known message", () => {
        for (const message of Object.keys(CFW_MESSAGE_KEYS)) {
            expect(cfwMessage(t, message)).not.toMatch(/^cfw\.messages\./);
        }
    });
});
