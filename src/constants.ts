export const CONFIG_DIR: string = `${Deno.env.get("HOME")}/.freebsd-up`;
export const DB_PATH: string = `${CONFIG_DIR}/state.sqlite`;
export const LOGS_DIR: string = `${CONFIG_DIR}/logs`;
export const EMPTY_DISK_THRESHOLD_KB: number = 100;
