import { Button, Tooltip } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

/** switches the filter of a file browser to search the subfolders too */
export const DeepSearchToggle = ({
    value,
    onChange,
}: {
    value: boolean;
    onChange: (value: boolean) => void;
}) => {
    const { t } = useTranslation();
    return (
        <Tooltip title={t("fileBrowser.searchSubfolders")}>
            <Button
                type={value ? "primary" : "text"}
                size="small"
                icon={<ApartmentOutlined />}
                aria-label={t("fileBrowser.searchSubfolders")}
                aria-pressed={value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(!value)}
            />
        </Tooltip>
    );
};
