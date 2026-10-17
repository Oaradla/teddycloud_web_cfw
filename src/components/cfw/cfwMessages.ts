import { TFunction } from "i18next";

/** the fixed texts of the server's /api/cfw answers and their keys under cfw.messages */
export const CFW_MESSAGE_KEYS: Record<string, string> = {
    "box not found": "boxNotFound",
    "image not found": "imageNotFound",
    "ruid missing or invalid": "ruidInvalid",
    "the image is for another box platform": "otherPlatform",
    "the box checks for an update now": "checkingNow",
    "port out of range": "portOutOfRange",
    "out of memory": "outOfMemory",
    "could not store the settings": "settingsNotStored",
    "could not save": "notSaved",
    "channel must be release, beta or alpha": "invalidChannel",
    "assignment removed": "assignmentRemoved",
    "assigned; the box checks for the update now": "assignedNow",
    "assigned; the box takes it at its next start": "assignedNextStart",
    "kind must be profile, event or none": "invalidKind",
    "an event tag needs 1 to 16 actions": "eventActions",
    "unknown command": "unknownCommand",
    "volume must be 0 to 15": "invalidVolume",
    "remote control is switched off for this box": "remoteOff",
    "the box is not connected with the custom firmware": "notConnected",
    "the firmware of the box has no remote control": "noRemote",
    "too many commands waiting": "tooManyCommands",
    "no image received": "noImage",
    "tag missing": "tagMissing",
    "CFW support is off (cfw.enabled)": "cfwOff",
};

/** a message of the server in the UI language; texts with values in them stay as sent */
export const cfwMessage = (t: TFunction, message: string) =>
    message in CFW_MESSAGE_KEYS ? t(`cfw.messages.${CFW_MESSAGE_KEYS[message]}`) : message;
