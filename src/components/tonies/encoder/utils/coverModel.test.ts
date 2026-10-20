import { describe, expect, it } from "vitest";

import { coverEntry, coverFileName, languageOf, trackTitle } from "./coverModel";

describe("coverModel", () => {
    it("names the chapters after the audio files", () => {
        expect(trackTitle("01 - Der Anfang.mp3")).toBe("Der Anfang");
        expect(trackTitle("2_Mitte.flac")).toBe("Mitte");
        expect(trackTitle("Ende.ogg")).toBe("Ende");
        expect(trackTitle("07.mp3")).toBe("07");
    });

    it("maps the UI language to a tonie language", () => {
        expect(languageOf("de")).toBe("de-de");
        expect(languageOf("en-US")).toBe("en-gb");
        expect(languageOf("xx")).toBe("");
    });

    it("gives the cover a free, safe name", () => {
        expect(coverFileName("Mein Bild (1).webp", 36 ** 3)).toBe("1000-Mein_Bild_1_.webp");
    });

    it("builds the model from the TAF header and the names", () => {
        expect(
            coverEntry(
                "custom-4",
                { audioId: 123, sha1Hash: "ABC" },
                {
                    series: " Ritter Rost ",
                    episodes: "",
                    tracks: ["Eins", "Zwei"],
                    language: "de-de",
                    pic: "/custom_img/x.webp",
                },
            ),
        ).toEqual({
            model: "custom-4",
            audio_id: ["123"],
            hash: ["ABC"],
            title: "Ritter Rost",
            series: "Ritter Rost",
            episodes: undefined,
            tracks: ["Eins", "Zwei"],
            language: "de-de",
            pic: "/custom_img/x.webp",
        });
        expect(
            coverEntry(
                "custom-5",
                { audioId: "9", sha1Hash: "H" },
                { series: "S", episodes: "Folge 1", tracks: [], language: "", pic: "" },
            ),
        ).toMatchObject({
            title: "S - Folge 1",
            episodes: "Folge 1",
            tracks: undefined,
            pic: undefined,
        });
        // a playlist: its own audio id too, with the hash of its TAF
        expect(
            coverEntry(
                "custom-6",
                { audioId: 7, sha1Hash: "H", alsoAudioIds: [8, 7] },
                { series: "S", episodes: "", tracks: [], language: "", pic: "" },
            ),
        ).toMatchObject({ audio_id: ["7", "8"], hash: ["H", "H"] });
    });
});
