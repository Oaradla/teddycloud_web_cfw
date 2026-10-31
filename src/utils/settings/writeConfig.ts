import { TeddyCloudApi } from "../../api";
import { ResponseError } from "../../api/runtime";
import { defaultAPIConfig } from "../../config/defaultApiConfig";

const api = new TeddyCloudApi(defaultAPIConfig());

/** writes the config; only admins may, for other users the server has saved each setting already (403) */
export async function writeConfig(): Promise<void> {
    await api.apiTriggerWriteConfigGet().catch((error) => {
        if (!(error instanceof ResponseError && error.response.status === 403)) throw error;
    });
}
