import { createRoot } from "react-dom/client";
import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import ConfirmationDialog from "../../components/common/modals/ConfirmationModal";

const api = new TeddyCloudApi(defaultAPIConfig());

/**
 * Asks before files of these names in a folder are replaced; true: go on.
 * query: the folder as the file index takes it, "path=...&special=..."
 */
export async function confirmReplace(
    t: (key: string, options?: Record<string, unknown>) => string,
    query: string,
    names: string[],
): Promise<boolean> {
    let existing: string[] = [];
    try {
        const index = await api.apiGetTeddyCloudApiRaw(`/api/fileIndexV2?${query}`);
        existing = ((await index.json()).files ?? []).map((f: { name: string }) => f.name);
    } catch {
        // without a list the upload goes on, as before
    }
    const found = names.filter((name) => existing.includes(name));
    if (!found.length) return true;

    return new Promise((resolve) => {
        const div = document.createElement("div");
        document.body.appendChild(div);
        const root = createRoot(div);
        const close = (ok: boolean) => {
            root.unmount();
            div.remove();
            resolve(ok);
        };
        root.render(
            <ConfirmationDialog
                title={t("fileBrowser.upload.replaceTitle")}
                open={true}
                okText={t("fileBrowser.upload.replace")}
                cancelText={t("fileBrowser.upload.cancel")}
                content={t("fileBrowser.upload.replaceText", { names: found.join(", ") })}
                handleOk={() => close(true)}
                handleCancel={() => close(false)}
            />,
        );
    });
}
