// Pictures of figures and covers are shown at a few hundred pixels at most; photos straight from
// a phone are megabytes. They are scaled down in the browser before they go to teddyCloud.

/** the long edge of a picture after shrinking, in pixels */
export const MAX_EDGE = 512;

const hasAlpha = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) return true;
    return false;
};

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** the file name with the extension of the picture type */
export const nameFor = (name: string, type: string) => {
    const ext = ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" } as const)[
        type as "image/webp"
    ];
    return ext ? `${name.replace(/\.[^.]+$/, "")}.${ext}` : name;
};

/**
 * A smaller copy of a picture: at most MAX_EDGE pixels on the long edge, as WebP where the browser
 * writes it (a fraction of PNG for cut-out figures, smaller than JPEG for photos; transparency
 * stays). Browsers without a WebP encoder (Safari) write PNG when it has transparency, else JPEG.
 * The original comes back when it is small already, and for vector graphics and GIFs (which may
 * be animated).
 */
export async function shrinkImage(input: File): Promise<File> {
    if (!/^image\/(png|jpeg|webp|avif|bmp)$/.test(input.type)) return input;
    const bitmap = await createImageBitmap(input);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    // a browser that cannot write WebP returns PNG instead
    const webp = await encode(canvas, "image/webp", 0.82);
    let blob = webp?.type === "image/webp" ? webp : null;
    if (!blob) {
        const png = hasAlpha(ctx, w, h);
        blob = await encode(canvas, png ? "image/png" : "image/jpeg", 0.86);
    }
    if (!blob || blob.size >= input.size) return input;
    return new File([blob], nameFor(input.name, blob.type), { type: blob.type });
}
