import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, List, Modal, Progress, Typography } from "antd";

import { TeddyCloudApi } from "../../../../api";
import { defaultAPIConfig } from "../../../../config/defaultApiConfig";
import { shrinkImage } from "../../../../utils/images/shrinkImage";
import { humanFileSize } from "../../../../utils/files/humanFileSize";
import type { CustomEntry } from "../types/customModelEditorTypes";

const { Paragraph, Text } = Typography;
const api = new TeddyCloudApi(defaultAPIConfig());

/** pictures above this size are offered for shrinking */
const LIMIT = 250 * 1024;
const PREFIX = "/custom_img/";

interface Big {
    pic: string;
    blob: Blob;
    entries: CustomEntry[];
}

/** the picture's folder in custom_img and its name */
const split = (pic: string) => {
    const rel = decodeURIComponent(pic.slice(PREFIX.length).split("?")[0]);
    const at = rel.lastIndexOf("/");
    return { dir: at < 0 ? "" : rel.slice(0, at), name: rel.slice(at + 1) };
};

/**
 * finds big pictures of the custom models in custom_img and replaces them by small copies; the
 * originals stay in the folder, the models point to the copies
 */
export const ImageOptimizerModal: React.FC<{
    open: boolean;
    entries: CustomEntry[];
    onClose: () => void;
    onSave: (entry: CustomEntry) => Promise<void>;
    onDone: () => void;
}> = ({ open, entries, onClose, onSave, onDone }) => {
    const { t } = useTranslation();
    const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
    const [big, setBig] = useState<Big[] | null>(null);
    const [work, setWork] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<{ count: number; before: number; after: number } | null>(
        null,
    );
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setBig(null);
        setResult(null);
        setError("");
        const byPic = new Map<string, CustomEntry[]>();
        for (const e of entries)
            if (e.pic?.startsWith(PREFIX)) byPic.set(e.pic, [...(byPic.get(e.pic) ?? []), e]);
        const pics = [...byPic.keys()];
        setScan({ done: 0, total: pics.length });
        (async () => {
            const found: Big[] = [];
            let i = 0;
            const worker = async () => {
                while (!cancelled && i < pics.length) {
                    const pic = pics[i++];
                    try {
                        const blob = await (await api.apiGetTeddyCloudApiRaw(pic)).blob();
                        if (blob.size > LIMIT) found.push({ pic, blob, entries: byPic.get(pic)! });
                    } catch {
                        // a missing picture is not ours to fix here
                    }
                    setScan((s) => (s ? { ...s, done: s.done + 1 } : s));
                }
            };
            await Promise.all(Array.from({ length: 4 }, worker));
            if (!cancelled) {
                setBig(found.sort((a, b) => b.blob.size - a.blob.size));
                setScan(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, entries]);

    const run = async () => {
        if (!big) return;
        setWork({ done: 0, total: big.length });
        let before = 0;
        let after = 0;
        let count = 0;
        for (let i = 0; i < big.length; i++) {
            const b = big[i];
            try {
                const { dir, name } = split(b.pic);
                const original = new File([b.blob], name, { type: b.blob.type });
                const small = await shrinkImage(original);
                if (small !== original && small.size < b.blob.size) {
                    // never over the original: a copy of the same type gets its own name
                    const copy =
                        small.name === name
                            ? new File([small], name.replace(/(\.[^.]+)?$/, "-small$1"), {
                                  type: small.type,
                              })
                            : small;
                    const form = new FormData();
                    form.append("file", copy, copy.name);
                    await api.apiPostTeddyCloudFormDataRaw(
                        `/api/fileUpload?path=${encodeURIComponent(dir)}&special=custom_img`,
                        form,
                    );
                    const pic = `${PREFIX}${dir ? `${dir}/` : ""}${copy.name}`;
                    for (const entry of b.entries) await onSave({ ...entry, pic });
                    before += b.blob.size;
                    after += copy.size;
                    count++;
                }
            } catch (e) {
                setError(`${b.pic}: ${(e as Error).message}`);
                if (count === 0) break; // nothing could be written, no use going on
            }
            setWork({ done: i + 1, total: big.length });
        }
        setWork(null);
        setResult({ count, before, after });
        onDone();
    };

    return (
        <Modal
            open={open}
            title={t("tonies.customEditor.optimizeImages.title")}
            onCancel={work ? undefined : onClose}
            closable={!work}
            okText={
                result
                    ? t("tonies.customEditor.optimizeImages.close")
                    : t("tonies.customEditor.optimizeImages.run", { count: big?.length ?? 0 })
            }
            cancelText={t("tonies.customEditor.optimizeImages.cancel")}
            okButtonProps={{ disabled: !result && !big?.length, loading: !!work }}
            cancelButtonProps={{
                style: result ? { display: "none" } : undefined,
                disabled: !!work,
            }}
            onOk={result ? onClose : run}
        >
            <Paragraph>
                {t("tonies.customEditor.optimizeImages.text", { kb: LIMIT / 1024 })}
            </Paragraph>
            {scan && (
                <Progress
                    percent={scan.total ? Math.round((scan.done / scan.total) * 100) : 100}
                    format={() => `${scan.done}/${scan.total}`}
                />
            )}
            {work && (
                <Progress
                    percent={Math.round((work.done / work.total) * 100)}
                    format={() => `${work.done}/${work.total}`}
                />
            )}
            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
            {result ? (
                <Alert
                    type="success"
                    showIcon
                    title={t("tonies.customEditor.optimizeImages.done", {
                        count: result.count,
                        before: humanFileSize(result.before),
                        after: humanFileSize(result.after),
                    })}
                />
            ) : big && !work ? (
                big.length === 0 ? (
                    <Alert
                        type="info"
                        showIcon
                        title={t("tonies.customEditor.optimizeImages.none")}
                    />
                ) : (
                    <List
                        size="small"
                        style={{ maxHeight: 300, overflow: "auto" }}
                        dataSource={big}
                        renderItem={(b) => (
                            <List.Item>
                                <Text ellipsis style={{ maxWidth: "75%" }}>
                                    {b.pic.slice(PREFIX.length)}
                                </Text>
                                <Text type="secondary">{humanFileSize(b.blob.size)}</Text>
                            </List.Item>
                        )}
                    />
                )
            ) : null}
        </Modal>
    );
};
