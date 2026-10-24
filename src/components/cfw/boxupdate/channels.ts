import { CfwBox, CfwChannel, CfwImage, CfwPlatform, formatBuild } from "../../../api/cfwApi";

export const CHANNELS: CfwChannel[] = ["release", "beta", "alpha"];

/** values of the setting cfw.update.channel */
export const CHANNEL_NUMBER: Record<CfwChannel, number> = {
    none: 0,
    release: 1,
    beta: 2,
    alpha: 3,
};

export const CHANNEL_COLOR: Record<CfwChannel, string | undefined> = {
    none: undefined,
    release: "green",
    beta: "blue",
    alpha: "purple",
};

export const imageLabel = (image: CfwImage, channelName: string) =>
    `${formatBuild(image.build)}${image.version ? " · " + image.version : ""} (${channelName})`;

export const platformOf = (item: { platform?: CfwPlatform }): CfwPlatform =>
    item.platform === "esp32" ? "esp32" : "cc3200";

/** the box gets the setup page of the image at its next start with teddyCloud: the image has one
 * and it is not the one the box reported last */
export const pageOffered = (box: CfwBox, image?: CfwImage) =>
    !!image?.page && image.page !== (box.pageVersion ?? 0);

/** the translation key of where an image is offered: its channel, or the return to the original firmware */
export const channelKey = (image: CfwImage) =>
    image.original ? "cfw.update.original" : `cfw.channel.${image.channel}`;

/** the images a box can take: those of its own platform; the original ESP32 firmware only a box running the
 * custom firmware, for the return */
export const imagesForBox = (images: CfwImage[], box: CfwBox) =>
    images.filter(
        (image) => platformOf(image) === platformOf(box) && (!image.original || box.isCfw),
    );

/** an ESP32 box with the original firmware takes its assigned image once, through its own update check */
export const esp32Installs = (box: CfwBox) =>
    !box.isCfw &&
    platformOf(box) === "esp32" &&
    box.update.target !== 0 &&
    box.esp32Delivered !== box.update.target;

/** custom firmware images nobody needs any more: not the newest of their platform and not running,
 * assigned or next on a box of that platform */
export const oldImages = (images: CfwImage[], boxes: CfwBox[]) => {
    const custom = images.filter((image) => !image.original);
    const newest = (image: CfwImage) =>
        custom.every(
            (other) => platformOf(other) !== platformOf(image) || other.build <= image.build,
        );
    const used = (image: CfwImage) =>
        boxes.some(
            (box) =>
                platformOf(box) === platformOf(image) &&
                [box.version, box.update.target, box.update.next].includes(image.build),
        );
    return custom.filter((image) => !newest(image) && !used(image));
};
