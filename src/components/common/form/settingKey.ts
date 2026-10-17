/**
 * translation key part of a setting or group id ("cfw.box" -> "cfw_box"): the server sends its texts in
 * English, settings.options / settings.groups / settings.values translate them
 */
export const settingKey = (id: string) => id.replace(/\./g, "_");
