import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Button,
    Checkbox,
    Collapse,
    Form,
    Input,
    Modal,
    Radio,
    Select,
    Space,
    Steps,
    Typography,
} from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

import { cfwApi } from "../../../../../api/cfwApi";
import { useTeddyCloud } from "../../../../../provider/TeddyCloudProvider";
import { NotificationTypeEnum } from "../../../../../types/teddyCloudNotificationTypes";
import nwpBootloaderUrl from "./rbtl3100s.dll?url";
import { Cc3200, ResetMode } from "./protocol";
import { macOfCertificate, packageFiles, saveZip } from "./cc3200Package";
import { CC3200SdCard, useCc3200Releases } from "./CC3200SdCard";
import { StatusLine, StepResult } from "./StatusLine";

const { Paragraph, Text } = Typography;

const equal = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((x, i) => x === b[i]);

const k = "tonieboxes.cc3200BoxFlashing.browser.";

/** asks before leaving the page while something is written to the box */
function useBusyGuard(busy: boolean) {
    useEffect(() => {
        if (!busy) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [busy]);
}

/**
 * A CC3200 box set up from the browser: backup, certificates and CA, the SD bootloader's preloader,
 * and the card content, all from the release package teddyCloud keeps. The box stays connected
 * from the backup to the bootloader.
 */
export function CC3200BrowserSetup({ onShowBoxes }: { onShowBoxes: () => void }) {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const [modal, modalContext] = Modal.useModal();
    const releases = useCc3200Releases();
    const [build, setBuild] = useState<number | undefined>();
    const release = releases?.find((r) => r.build === build) ?? releases?.[0];

    const [step, setStep] = useState(0);
    const [gateway, setGateway] = useState(false);
    const [reset, setReset] = useState<ResetMode>("dtr");
    const [acks, setAcks] = useState({ risk: false, fw: false, uart: false });
    const box = useRef<Cc3200 | null>(null);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");
    const [result, setResult] = useState<StepResult>(null);
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string[]>([]);
    const backup = useRef<{ flash: Uint8Array; files: Map<string, Uint8Array> } | null>(null);
    const [backupSaved, setBackupSaved] = useState(false);
    const [storedName, setStoredName] = useState("");
    const [failed, setFailed] = useState<string[]>([]);
    const [mac, setMac] = useState("");
    const [certsDone, setCertsDone] = useState(false);
    const [bootloaderDone, setBootloaderDone] = useState(false);

    useBusyGuard(busy);
    const addLog = (line: string) => setLog((l) => [...l.slice(-300), line]);
    const notify = (type: "success" | "error", text: string) =>
        addNotification(
            type === "success" ? NotificationTypeEnum.Success : NotificationTypeEnum.Error,
            t(k + "title"),
            text,
            t(k + "title"),
        );
    const confirm = (title: string, content: string, okText: string, danger = false) =>
        modal.confirm({ title, content, okText, okButtonProps: { danger } });

    /** runs one action on the box; what it returns is shown as done, nothing (e.g. cancelled) keeps the last result */
    const run = async (what: () => Promise<string | void>) => {
        setBusy(true);
        setResult(null);
        try {
            const done = await what();
            if (done) setResult({ ok: true, text: done });
        } catch (e) {
            const message = (e as Error).message;
            addLog(`error: ${message}`);
            notify("error", message);
            setResult({ ok: false, text: message });
        } finally {
            setBusy(false);
            setStatus("");
            setProgress(0);
        }
    };

    const connectAndBackUp = () =>
        run(async () => {
            const port = await navigator.serial.requestPort();
            setStatus(t(k + "connecting"));
            const cc = await Cc3200.connect(port, {
                gateway,
                reset,
                log: addLog,
                askReset: async () => {
                    await confirm(t(k + "reset"), t(k + "resetAsk"), "OK");
                },
                loadNwpBootloader: async () =>
                    new Uint8Array(await (await fetch(nwpBootloaderUrl)).arrayBuffer()),
            });
            box.current = cc;
            setConnected(true);
            setStatus(t(k + "readingFlash"));
            const flash = await cc.readFlash((done, total) => setProgress(done / total));
            const all = await cc.readAllFiles((name, i, n) => {
                setStatus(t(k + "readingFile", { name, i: i + 1, n }));
                setProgress((i + 1) / n);
            });
            backup.current = { flash, files: all.files };
            setFailed(all.failed);
            const client = all.files.get("/cert/client.der");
            const found = client ? macOfCertificate(client) : "";
            setMac(found);
            const done = t(k + "backupDone", {
                files: all.files.size,
                kb: Math.round(flash.length / 1024),
                mac: found || "?",
            });
            addLog(done);
            // the raw flash also on the server; then the download is no longer required
            try {
                const name = await cfwApi.storeDump(`CC3200_${found || "unknown"}`, flash);
                setStoredName(name);
                setBackupSaved(true);
                addLog(`flash stored on the server: ${name}`);
            } catch (e) {
                addLog(`flash not stored on the server: ${(e as Error).message}`);
            }
            return done;
        });

    const downloadBackup = async () => {
        const b = backup.current!;
        const entries: Record<string, Uint8Array> = { "backup.bin": b.flash };
        for (const [name, data] of b.files)
            entries[`ExtractedFromBox${name.startsWith("/") ? "" : "/"}${name}`] = data;
        await saveZip(entries, `toniebox-${mac || "cc3200"}-backup.zip`);
        setBackupSaved(true);
    };

    const certificates = () =>
        run(async () => {
            const files = backup.current!.files;
            const certs = ["ca.der", "client.der", "private.der"].map((name) => ({
                name,
                data: files.get(`/cert/${name}`),
            }));
            const missing = certs.filter((c) => !c.data).map((c) => c.name);
            if (missing.length) throw new Error(`missing on the box: ${missing.join(", ")}`);
            await cfwApi.uploadCertsByMac(mac, certs as { name: string; data: Uint8Array }[]);
            addLog(`certificates stored for ${mac}`);
            await box.current!.writeFile("/cert/c2.der", await cfwApi.caReplacement());
            addLog("/cert/c2.der written");
            setCertsDone(true);
            notify("success", t(k + "certsDone"));
            return t(k + "certsDone");
        });

    const bootloader = () =>
        run(async () => {
            if (
                !(await confirm(
                    t(k + "bootloaderConfirm"),
                    t(k + "bootloaderConfirmText"),
                    t(k + "bootloaderRun"),
                    true,
                ))
            )
                return;
            const cc = box.current!;
            const preloader = (
                await packageFiles(await cfwApi.package(release!.build), "cc3200/flash/")
            )["sys/mcuimg.bin"];
            if (!preloader) throw new Error("the package has no preloader");
            const current = backup.current!.files.get("/sys/mcuimg.bin");
            if (await cc.exists("/sys/pre-img.bin")) {
                // HackieboxNG is there: /sys/mcuimg.bin is its preloader already, the original stays in pre-img.bin
                addLog(t(k + "hasHackiebox"));
                if (current && equal(current, preloader)) {
                    setBootloaderDone(true);
                    return t(k + "bootloaderUpToDate");
                }
            } else {
                if (!current) throw new Error("/sys/mcuimg.bin was not in the backup");
                await cc.writeFile("/sys/pre-img.bin", current);
                addLog("original bootloader moved to /sys/pre-img.bin");
            }
            await cc.writeFile("/sys/mcuimg.bin", preloader);
            addLog("preloader written to /sys/mcuimg.bin");
            setBootloaderDone(true);
            notify("success", t(k + "bootloaderDone"));
            return t(k + "bootloaderDone");
        });

    const disconnect = async () => {
        if (box.current) {
            await box.current.close();
            box.current = null;
            setConnected(false);
        }
    };

    if (!("serial" in navigator))
        return <Alert type="warning" showIcon title={t(k + "noSerial")} />;
    if (window.location.protocol !== "https:")
        return <Alert type="warning" showIcon title={t(k + "https")} />;

    const steps = [
        <>
            <Paragraph>{t(k + "intro")}</Paragraph>
            {releases && releases.length === 0 ? (
                <Alert type="warning" showIcon title={t(k + "releaseNone")} />
            ) : (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                    <Form.Item label={t(k + "release")}>
                        <Select
                            value={release?.build}
                            onChange={setBuild}
                            loading={!releases}
                            options={(releases ?? []).map((r) => ({
                                value: r.build,
                                label: `${r.version || r.build} (${r.channel})`,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item label={t(k + "hwTool")}>
                        <Radio.Group
                            value={gateway ? "gw" : "uart"}
                            onChange={(e) => setGateway(e.target.value === "gw")}
                            optionType="button"
                            options={[
                                { value: "uart", label: t(k + "hwUart") },
                                { value: "gw", label: t(k + "hwEsp32c3") },
                            ]}
                        />
                    </Form.Item>
                    {!gateway && (
                        <Form.Item label={t(k + "reset")}>
                            <Radio.Group
                                value={reset}
                                onChange={(e) => setReset(e.target.value)}
                                optionType="button"
                                options={[
                                    { value: "dtr", label: t(k + "resetDtr") },
                                    { value: "manual", label: t(k + "resetManual") },
                                ]}
                            />
                        </Form.Item>
                    )}
                </Form>
            )}
            <Paragraph type="secondary">{t(k + "debugPort")}</Paragraph>
            <Space direction="vertical">
                {(
                    [
                        ["risk", "ackRisk"],
                        ["fw", "ackFw"],
                        ["uart", "ackUart"],
                    ] as const
                ).map(([key, text]) => (
                    <Checkbox
                        key={key}
                        checked={acks[key]}
                        onChange={(e) => setAcks({ ...acks, [key]: e.target.checked })}
                    >
                        {t(k + text)}
                    </Checkbox>
                ))}
            </Space>
        </>,
        <>
            <Paragraph>{t(k + "connectText")}</Paragraph>
            <Button type="primary" disabled={busy || connected} onClick={connectAndBackUp}>
                {t(k + "connect")}
            </Button>
            {backup.current && (
                <div style={{ marginTop: 16 }}>
                    {failed.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            title={t(k + "backupFailed", { list: failed.join("; ") })}
                            style={{ marginBottom: 16 }}
                        />
                    )}
                    <Form layout="vertical" style={{ maxWidth: 480 }}>
                        <Form.Item label={t(k + "mac")} extra={t(k + "macHint")}>
                            <Input
                                value={mac}
                                style={{ fontFamily: "monospace" }}
                                onChange={(e) =>
                                    setMac(
                                        e.target.value
                                            .replace(/[^0-9a-fA-F]/g, "")
                                            .toLowerCase()
                                            .slice(0, 12),
                                    )
                                }
                            />
                        </Form.Item>
                    </Form>
                    {storedName && (
                        <Alert
                            type="success"
                            showIcon
                            title={t(k + "backupStored", { name: storedName })}
                            style={{ marginBottom: 16 }}
                        />
                    )}
                    <Button onClick={downloadBackup}>{t(k + "downloadBackup")}</Button>
                </div>
            )}
        </>,
        <>
            <Paragraph>{t(k + "certsText")}</Paragraph>
            <Button
                type="primary"
                disabled={busy || !connected || certsDone || mac.length !== 12}
                onClick={certificates}
            >
                {t(k + "certsRun")}
            </Button>
        </>,
        <>
            <Paragraph>{t(k + "bootloaderText")}</Paragraph>
            <Button
                type="primary"
                disabled={busy || !connected || bootloaderDone}
                onClick={bootloader}
            >
                {t(k + "bootloaderRun")}
            </Button>
        </>,
        <>
            <CC3200SdCard build={release?.build} mac={mac} onSaved={disconnect} />
            <Alert type="info" showIcon title={t(k + "showBoxesHint")} style={{ marginTop: 16 }} />
        </>,
    ];

    // each step needs the one before done: the first two always, certificates and bootloader can be
    // skipped on purpose (done before, e.g. by hand), after a question
    const canGo = [
        !!releases?.length && Object.values(acks).every(Boolean),
        backupSaved && mac.length === 12,
        certsDone,
        bootloaderDone,
        true,
    ];
    const blocked = [t(k + "acksFirst"), !backupSaved ? t(k + "backupFirst") : t(k + "macFirst")];
    const skip = [
        null,
        null,
        { title: t(k + "certsSkip"), text: t(k + "certsSkipText") },
        { title: t(k + "bootloaderSkip"), text: t(k + "bootloaderSkipText") },
    ];
    const goTo = async (n: number) => {
        if (busy) return;
        if (n <= step) return setStep(n);
        for (let i = step; i < n; i++) {
            if (canGo[i]) continue;
            const ask = skip[i];
            setStep(i);
            if (!ask) {
                setResult({ ok: false, text: blocked[i] });
                return;
            }
            if (!(await confirm(ask.title, ask.text, t(k + "skipAnyway"), true))) return;
        }
        setResult(null);
        setStep(n);
    };

    const titles = [
        t(k + "stepPrepare"),
        t(k + "connect"),
        t(k + "certs"),
        t(k + "bootloader"),
        t(k + "card"),
    ];
    return (
        <>
            {modalContext}
            <Steps
                current={step}
                onChange={goTo}
                items={titles.map((title, i) => ({
                    title,
                    disabled: busy,
                    status: i === step ? "process" : i < step ? "finish" : "wait",
                }))}
            />
            <div style={{ marginTop: 24 }}>{steps[step]}</div>
            <StatusLine busy={busy} text={status} progress={progress} result={result} />
            <div
                style={{
                    marginTop: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                }}
            >
                {step > 0 ? (
                    <Button icon={<LeftOutlined />} disabled={busy} onClick={() => goTo(step - 1)}>
                        {t("tonieboxes.cc3200BoxFlashing.previous")}
                    </Button>
                ) : (
                    <div />
                )}
                {step < steps.length - 1 ? (
                    <Button
                        icon={<RightOutlined />}
                        iconPlacement="end"
                        disabled={busy}
                        onClick={() => goTo(step + 1)}
                    >
                        {t("tonieboxes.cc3200BoxFlashing.next")}
                    </Button>
                ) : (
                    <Button type="primary" onClick={onShowBoxes}>
                        {t("tonieboxes.cc3200BoxFlashing.checkBoxes")}
                    </Button>
                )}
            </div>
            <Collapse
                style={{ marginTop: 24 }}
                size="small"
                items={[
                    {
                        key: "log",
                        label: `${t(k + "log")} · ${connected ? t(k + "connected") : t(k + "notConnected")}`,
                        children: (
                            <>
                                <div
                                    style={{
                                        fontFamily: "monospace",
                                        fontSize: 12,
                                        maxHeight: 300,
                                        overflow: "auto",
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {log.map((l, i) => (
                                        <div key={i}>{l}</div>
                                    ))}
                                    {log.length === 0 && <Text type="secondary">-</Text>}
                                </div>
                                {connected && (
                                    <Button
                                        size="small"
                                        style={{ marginTop: 8 }}
                                        disabled={busy}
                                        onClick={disconnect}
                                    >
                                        {t(k + "disconnect")}
                                    </Button>
                                )}
                            </>
                        ),
                    },
                ]}
            />
        </>
    );
}
