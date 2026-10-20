import type { MenuProps } from "antd";

type Items = NonNullable<MenuProps["items"]>;

/**
 * Menu entries for users who are no admins: hidden keys are left out,
 * "flatten" keys are replaced by their children (the parent page is admin only).
 */
export function restrictMenu(
    items: MenuProps["items"],
    hide: string[],
    flatten: string[] = [],
): MenuProps["items"] {
    const out: Items = [];
    for (const item of items ?? []) {
        if (!item) continue;
        const key = String((item as { key?: unknown }).key ?? "");
        if (
            hide.includes(key) ||
            hide.some((h) => h.endsWith("*") && key.startsWith(h.slice(0, -1)))
        ) {
            continue;
        }
        const children = (item as { children?: MenuProps["items"] }).children;
        if (flatten.includes(key)) {
            out.push(...((restrictMenu(children, hide, flatten) ?? []) as Items));
            continue;
        }
        out.push(
            children
                ? ({ ...item, children: restrictMenu(children, hide, flatten) } as Items[number])
                : item,
        );
    }
    return out;
}
