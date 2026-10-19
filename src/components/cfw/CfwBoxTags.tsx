import React from "react";
import { useTranslation } from "react-i18next";
import { Tag, Tooltip } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";

import { CfwBox, cfwEnabledFor, formatBuild } from "../../api/cfwApi";

/** battery report and running build of a box with the custom firmware, for its box card */
export const CfwBoxTags: React.FC<{ box?: CfwBox }> = ({ box }) => {
    const { t } = useTranslation();
    if (!box || !cfwEnabledFor(box)) return null;

    return (
        <>
            {box.battery && box.showBattery !== false ? (
                <Tooltip
                    title={t(
                        box.battery.station
                            ? "cfw.box.batteryTooltipStation"
                            : "cfw.box.batteryTooltip",
                        {
                            time: new Date(box.battery.time * 1000).toLocaleString(),
                        },
                    )}
                >
                    <Tag
                        color={
                            box.battery.critical
                                ? "red"
                                : box.battery.low
                                  ? "orange"
                                  : box.battery.station
                                    ? "green"
                                    : undefined
                        }
                        style={{ marginInlineEnd: 4 }}
                    >
                        {box.battery.station ? <ThunderboltOutlined /> : null}{" "}
                        {/* on the charger the box measures the charger, not the battery */}
                        {!box.battery.station && box.battery.percent !== undefined
                            ? `${box.battery.percent} % · `
                            : ""}
                        {(box.battery.mv / 1000).toFixed(2)} V
                    </Tag>
                </Tooltip>
            ) : null}
            {box.isCfw ? (
                <Tooltip title={t("cfw.box.badgeTooltip", { build: formatBuild(box.version) })}>
                    <Tag
                        color={box.rolledBackBuild ? "orange" : "geekblue"}
                        style={{ marginInlineEnd: 4 }}
                    >
                        CFW {formatBuild(box.version).slice(0, 10)}
                    </Tag>
                </Tooltip>
            ) : null}
        </>
    );
};
