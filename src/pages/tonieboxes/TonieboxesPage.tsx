import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert } from "antd";

import BreadcrumbWrapper, {
    StyledContent,
    StyledLayout,
    StyledSider,
} from "../../components/common/StyledComponents";

import { CfwControls } from "../../components/cfw/CfwControls";
import { useCfwEnabled } from "../../components/cfw/useCfwEnabled";
import { TonieboxesSubNav } from "../../components/tonieboxes/TonieboxesSubNav";
import { TonieboxesList } from "../../components/tonieboxes/tonieboxeslist/TonieboxesList";
import {
    OwnerFilterSelect,
    useOwnerFilter,
} from "../../components/common/elements/OwnerFilterSelect";

import { useNewBoxesAllowed } from "../../hooks/getsettings/useGetSettingNewBoxesAllowed";
import { useTonieboxes } from "../../hooks/useTonieboxes";

export const TonieboxesPage = () => {
    const { t } = useTranslation();

    const newBoxesAllowed = useNewBoxesAllowed();
    const { tonieboxes } = useTonieboxes();
    const cfwEnabled = useCfwEnabled();
    const ownerFilter = useOwnerFilter("boxes");

    return (
        <>
            <StyledSider>
                <TonieboxesSubNav />
            </StyledSider>

            <StyledLayout>
                <BreadcrumbWrapper
                    items={[
                        { title: <Link to="/">{t("home.navigationTitle")}</Link> },
                        { title: t("tonieboxes.navigationTitle") },
                    ]}
                />

                <StyledContent>
                    <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
                    >
                        <h1 style={{ flex: 1 }}>{t("tonieboxes.title")}</h1>
                        <OwnerFilterSelect filter={ownerFilter} />
                    </div>

                    {newBoxesAllowed.value && (
                        <Alert
                            title={t("tonieboxes.newBoxesAllowed")}
                            description={t("tonieboxes.newBoxesAllowedText")}
                            type="warning"
                            showIcon
                            style={{ margin: "16px 0" }}
                        />
                    )}

                    <TonieboxesList
                        tonieboxCards={tonieboxes.filter((box) => ownerFilter.keep(box.ID))}
                    />

                    {cfwEnabled && <CfwControls />}
                </StyledContent>
            </StyledLayout>
        </>
    );
};
