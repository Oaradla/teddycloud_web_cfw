import { useCallback, useEffect, useRef, useState } from "react";

import { cfwApi, CfwBox } from "../../api/cfwApi";

interface CfwBoxesOptions {
    /** false: no request, no boxes (CFW support off or not known yet) */
    active: boolean | undefined;
    /** reload every that many milliseconds; 0 or missing: load once */
    pollMs?: number;
    /** load again when it changes, e.g. the joined IDs of the boxes shown */
    refreshKey?: string;
}

/** the boxes as teddyCloud's custom firmware support sees them (/api/cfw/boxes) */
export const useCfwBoxes = ({ active, pollMs = 0, refreshKey = "" }: CfwBoxesOptions) => {
    const [boxes, setBoxes] = useState<CfwBox[]>([]);
    const [error, setError] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const reload = useCallback(async () => {
        try {
            const loaded = await cfwApi.boxes();
            if (mounted.current) {
                setBoxes(loaded);
                setError(undefined);
            }
        } catch (e) {
            if (mounted.current) {
                setBoxes([]);
                setError(String(e));
            }
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!active) {
            setBoxes([]);
            setLoading(active === undefined);
            return;
        }
        void reload();
        if (!pollMs) return;
        const timer = window.setInterval(() => void reload(), pollMs);
        return () => window.clearInterval(timer);
    }, [active, pollMs, refreshKey, reload]);

    return { boxes, loading, error, reload };
};

/** the entry of a box (by its ID, the overlay name) */
export const findCfwBox = (boxes: CfwBox[], id: string) =>
    boxes.find((box) => box.id.toLowerCase() === id.toLowerCase());
