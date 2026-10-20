import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Form, Input, Select, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

import { cfwApi, CfwImage } from "../../../../../api/cfwApi";
import { TeddyCloudApi } from "../../../../../api/apis/TeddyCloudApi";
import { defaultAPIConfig } from "../../../../../config/defaultApiConfig";
import { cardConfig, cc3200Releases, packageFiles, saveZip } from "./cc3200Package";
import { StatusLine, StepResult } from "./StatusLine";

const { Paragraph } = Typography;
const api = new TeddyCloudApi(defaultAPIConfig());

/** the CC3200 release packages of the library; loading until the list is there */
export function useCc3200Releases() {
    const [releases, setReleases] = useState<CfwImage[] | null>(null);
    useEffect(() => {
        cfwApi
            .firmware()
            .then((r) => setReleases(cc3200Releases(r.images)))
            .catch(() => setReleases([]));
    }, []);
    return releases;
}

/**
 * The content of the SD card of a CC3200 box: SD bootloader, firmware, setup page and the server
 * settings, from a release package. On its own for a box that runs HackieboxNG already, or as the
 * last step of the setup in the browser (build given).
 */
export function CC3200SdCard({
    build,
    mac = "",
    onSaved,
}: {
    build?: number;
    mac?: string;
    onSaved?: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const releases = useCc3200Releases();
    const [chosen, setChosen] = useState<number | undefined>();
    const release =
        releases?.find((r) => r.build === (build ?? chosen)) ?? releases?.[0] ?? undefined;
    const [host, setHost] = useState(window.location.hostname);
    const [seenHost, setSeenHost] = useState("");
    const [port, setPort] = useState("443");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<StepResult>(null);

    useEffect(() => {
        // the address the other boxes use: the web address may be a reverse proxy the box cannot use
        cfwApi
            .boxHost()
            .then((r) => {
                const seen = r.host.replace(/:\d+$/, "");
                setSeenHost(seen);
                if (seen) setHost(seen);
            })
            .catch(() => {});
        api.apiGetTeddyCloudSettingRaw("core.server.https_api_port")
            .then((r) => r.text())
            .then((p) => p.trim() && setPort(p.trim()))
            .catch(() => {});
    }, []);

    const download = async () => {
        if (!release) return;
        setBusy(true);
        setResult(null);
        try {
            const files = await packageFiles(await cfwApi.package(release.build), "cc3200/card/");
            files["cfw/config.txt"] = cardConfig(host, port);
            await saveZip(files, `toniebox-${mac || "cc3200"}-sdcard.zip`);
            await onSaved?.();
            setResult({ ok: true, text: t("tonieboxes.cc3200BoxFlashing.browser.cardSaved") });
        } catch (e) {
            setResult({ ok: false, text: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    if (releases && releases.length === 0)
        return (
            <Alert
                type="warning"
                showIcon
                title={t("tonieboxes.cc3200BoxFlashing.browser.releaseNone")}
            />
        );
    return (
        <>
            <Paragraph>{t("tonieboxes.cc3200BoxFlashing.browser.cardText")}</Paragraph>
            <Form layout="vertical" style={{ maxWidth: 480 }}>
                {build === undefined && (
                    <Form.Item label={t("tonieboxes.cc3200BoxFlashing.browser.release")}>
                        <Select
                            value={release?.build}
                            onChange={setChosen}
                            loading={!releases}
                            options={(releases ?? []).map((r) => ({
                                value: r.build,
                                label: `${r.version || r.build} (${r.channel})`,
                            }))}
                        />
                    </Form.Item>
                )}
                <Form.Item
                    label={t("tonieboxes.cc3200BoxFlashing.browser.host")}
                    extra={
                        seenHost
                            ? t("tonieboxes.cc3200BoxFlashing.browser.hostSeen", { host: seenHost })
                            : t("tonieboxes.cc3200BoxFlashing.browser.hostHint")
                    }
                >
                    <Input value={host} onChange={(e) => setHost(e.target.value)} />
                </Form.Item>
                <Form.Item label={t("tonieboxes.cc3200BoxFlashing.browser.port")}>
                    <Input
                        value={port}
                        inputMode="numeric"
                        style={{ maxWidth: 140 }}
                        onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                </Form.Item>
            </Form>
            <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={busy}
                disabled={!host.trim() || !release}
                onClick={download}
            >
                {t("tonieboxes.cc3200BoxFlashing.browser.cardDownload")}
            </Button>
            <StatusLine
                busy={busy}
                text={t("tonieboxes.cc3200BoxFlashing.browser.cardBuilding")}
                result={result}
            />
        </>
    );
}
