/** the server takes at most 255 bytes of query; "path=" and "&special=library" leave 234 for the path */
export const MAX_ENCODED_PATH = 234;

export const isPathTooLong = (path: string) => encodeURIComponent(path).length > MAX_ENCODED_PATH;
