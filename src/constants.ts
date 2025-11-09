export const CONFIG_DIR: string = `${Deno.env.get("HOME")}/.freebsd-up`;
export const DB_PATH: string = `${CONFIG_DIR}/state.sqlite`;
export const LOGS_DIR: string = `${CONFIG_DIR}/logs`;
export const EMPTY_DISK_THRESHOLD_KB: number = 100;
export const CONFIG_FILE_NAME: string = "vmconfig.toml";
export const IMAGE_DIR: string = `${CONFIG_DIR}/images`;
