import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { TonieCardProps } from "../../../../types/tonieTypes";
import { useAcl } from "../../../../provider/AclProvider";

const api = new TeddyCloudApi(defaultAPIConfig());

/**
 * Assign a "lib://" or "http(s)://" source path to a Tonie tag, mirroring
 * useTonieCardSaveFlow.handleSourceSave (source + nocloud + live follow-up, those two only with
 * the edit right).
 */
export const useAssignSourceToTonie = () => {
    const acl = useAcl();
    const assignSourceToTonie = async (
        tonieCard: TonieCardProps,
        path: string,
        overlay: string,
    ) => {
        await api.apiPostTeddyCloudContentJson(
            tonieCard.ruid,
            "source=" + encodeURIComponent(path),
            overlay,
        );

        if (!acl.can("tonie", tonieCard.ruid, "tonie.edit")) {
            return;
        }
        if (!tonieCard.nocloud) {
            await api.apiPostTeddyCloudContentJson(tonieCard.ruid, "nocloud=true", overlay);
        }

        const shouldBeLive = path.startsWith("http");
        if (shouldBeLive !== tonieCard.live) {
            await api.apiPostTeddyCloudContentJson(tonieCard.ruid, "live=" + shouldBeLive, overlay);
        }
    };

    return { assignSourceToTonie };
};
