import React from "react";
import { TreeSelect } from "antd";
import type { TreeSelectProps } from "antd";
import type { DirectoryTreeApi } from "../hooks/useDirectoryTree";

interface Props {
    directoryTree: DirectoryTreeApi;
    disabled?: boolean;
    placeholder?: string;
    /** folders the user may not pick are shown, but disabled */
    isSelectable?: (fullPath: string) => boolean;
    className?: string;
    style?: React.CSSProperties;
}

export const DirectoryTreeSelect: React.FC<Props> = ({
    directoryTree,
    disabled = false,
    placeholder,
    isSelectable,
    className,
    style,
}) => {
    const { treeData, treeNodeId, setTreeNodeId, expandedKeys, setExpandedKeys, onLoadTreeData } =
        directoryTree;

    const handleLoadTreeData: TreeSelectProps["loadData"] = ({ id }) =>
        onLoadTreeData({ id: String(id) });

    return (
        <TreeSelect
            className={className || "tree-select"}
            treeLine
            treeDataSimpleMode
            value={treeNodeId || undefined}
            popupMatchSelectWidth={false}
            style={{ minWidth: 0, ...(style || {}) }}
            styles={{
                popup: {
                    root: {
                        maxHeight: 400,
                        overflow: "auto",
                        maxWidth: "calc(100vw - 32px)",
                    },
                },
            }}
            onChange={setTreeNodeId}
            loadData={handleLoadTreeData}
            treeData={
                isSelectable
                    ? treeData.map((node) => ({ ...node, disabled: !isSelectable(node.fullPath) }))
                    : treeData
            }
            treeNodeLabelProp="fullPath"
            placeholder={placeholder}
            treeExpandedKeys={expandedKeys}
            onTreeExpand={(keys) => setExpandedKeys(keys.map(String))}
            disabled={disabled}
        />
    );
};
