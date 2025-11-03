import { createId } from "@paralleldrive/cuid2";
import chalk from "chalk";
import _ from "lodash";
import Moniker from "moniker";
import { generateRandomMacAddress } from "./network.ts";
import { saveInstanceState } from "./state.ts";

const DEFAULT_VERSION = "14.3-RELEASE";

export interface Options {
  output?: string;
  cpu: string;
  cpus: number;
  memory: string;
  drive?: string;
  diskFormat: string;
  size: string;
  bridge?: string;
}

async function du(path: string): Promise<number> {
  const cmd = new Deno.Command("du", {
    args: [path],
    stdout: "piped",
    stderr: "inherit",
  });

  const { stdout } = await cmd.spawn().output();
  const output = new TextDecoder().decode(stdout).trim();
  const size = parseInt(output.split("\t")[0], 10);
  return size;
}

export async function emptyDiskImage(path: string): Promise<boolean> {
  if (!await Deno.stat(path).catch(() => false)) {
    return true;
  }

  const size = await du(path);
  return size < 100;
}

export async function downloadIso(
  url: string,
  options: Options,
): Promise<string | null> {
  const filename = url.split("/").pop()!;
  const outputPath = options.output ?? filename;

  if (options.drive && await Deno.stat(options.drive).catch(() => false)) {
    const driveSize = await du(options.drive);
    if (driveSize > 10) {
      console.log(
        chalk.yellowBright(
          `Drive image ${options.drive} is not empty (size: ${driveSize} KB), skipping ISO download to avoid overwriting existing data.`,
        ),
      );
      return null;
    }
  }

  if (await Deno.stat(outputPath).catch(() => false)) {
    console.log(
      chalk.yellowBright(
        `File ${outputPath} already exists, skipping download.`,
      ),
    );
    return outputPath;
  }

  const cmd = new Deno.Command("curl", {
    args: ["-L", "-o", outputPath, url],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;
  if (!status.success) {
    console.error(chalk.redBright("Failed to download ISO image."));
    Deno.exit(status.code);
  }

  console.log(chalk.greenBright(`Downloaded ISO to ${outputPath}`));
  return outputPath;
}

export function constructDownloadUrl(version: string): string {
  let arch = "amd64";

  if (Deno.build.arch === "aarch64") {
    arch = "arm64-aarch64";
  }

  return `https://download.freebsd.org/ftp/releases/ISO-IMAGES/${
    version.split("-")[0]
  }/FreeBSD-${version}-${arch}-disc1.iso`;
}

export async function setupFirmwareFilesIfNeeded(): Promise<string[]> {
  if (Deno.build.arch !== "aarch64") {
    return [];
  }

  const brewCmd = new Deno.Command("brew", {
    args: ["--prefix", "qemu"],
    stdout: "piped",
    stderr: "inherit",
  });
  const { stdout, success } = await brewCmd.spawn().output();

  if (!success) {
    console.error(
      chalk.redBright(
        "Failed to get QEMU prefix from Homebrew. Ensure QEMU is installed via Homebrew.",
      ),
    );
    Deno.exit(1);
  }

  const brewPrefix = new TextDecoder().decode(stdout).trim();
  const edk2Aarch64 = `${brewPrefix}/share/qemu/edk2-aarch64-code.fd`;
  const edk2VarsAarch64 = "./edk2-arm-vars.fd";

  await Deno.copyFile(
    `${brewPrefix}/share/qemu/edk2-arm-vars.fd`,
    edk2VarsAarch64,
  );

  return [
    "-drive",
    `if=pflash,format=raw,file=${edk2Aarch64},readonly=on`,
    "-drive",
    `if=pflash,format=raw,file=${edk2VarsAarch64}`,
  ];
}

export async function runQemu(
  isoPath: string | null,
  options: Options,
): Promise<void> {
  const macAddress = generateRandomMacAddress();

  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";
  const cmd = new Deno.Command(options.bridge ? "sudo" : qemu, {
    args: [
      ..._.compact([options.bridge && qemu]),
      ..._.compact(
        Deno.build.os === "darwin" ? ["-accel", "hvf"] : ["-enable-kvm"],
      ),
      ..._.compact(
        Deno.build.arch === "aarch64" && ["-machine", "virt,highmem=on"],
      ),
      "-cpu",
      options.cpu,
      "-m",
      options.memory,
      "-smp",
      options.cpus.toString(),
      ..._.compact([isoPath && "-cdrom", isoPath]),
      "-netdev",
      options.bridge
        ? `bridge,id=net0,br=${options.bridge}`
        : "user,id=net0,hostfwd=tcp::2222-:22",
      "-device",
      `e1000,netdev=net0,mac=${macAddress}`,
      "-nographic",
      "-monitor",
      "none",
      "-chardev",
      "stdio,id=con0,signal=off",
      "-serial",
      "chardev:con0",
      ...await setupFirmwareFilesIfNeeded(),
      ..._.compact(
        options.drive && [
          "-drive",
          `file=${options.drive},format=${options.diskFormat},if=virtio`,
        ],
      ),
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  await saveInstanceState({
    id: createId(),
    name: Moniker.choose(),
    bridge: options.bridge,
    macAddress,
    memory: options.memory,
    cpus: options.cpus,
    cpu: options.cpu,
    diskSize: options.size,
    diskFormat: options.diskFormat,
    isoPath: isoPath ? Deno.realPathSync(isoPath) : undefined,
    drivePath: options.drive ? Deno.realPathSync(options.drive) : undefined,
    version: DEFAULT_VERSION,
    status: "RUNNING",
    pid: cmd.pid,
  });

  const status = await cmd.status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}

export function handleInput(input?: string): string {
  if (!input) {
    console.log(
      chalk.blueBright(
        `No ISO path provided, defaulting to ${chalk.cyan("FreeBSD")} ${
          chalk.cyan(DEFAULT_VERSION)
        }...`,
      ),
    );
    return constructDownloadUrl(DEFAULT_VERSION);
  }

  const versionRegex = /^\d{1,2}\.\d{1,2}-(RELEASE|BETA\d*|RC\d*)$/;

  if (versionRegex.test(input)) {
    console.log(
      chalk.blueBright(
        `Detected version ${chalk.cyan(input)}, constructing download URL...`,
      ),
    );
    return constructDownloadUrl(input);
  }

  return input;
}

export async function createDriveImageIfNeeded(
  {
    drive: path,
    diskFormat: format,
    size,
  }: Options,
): Promise<void> {
  if (await Deno.stat(path!).catch(() => false)) {
    console.log(
      chalk.yellowBright(
        `Drive image ${path} already exists, skipping creation.`,
      ),
    );
    return;
  }

  const cmd = new Deno.Command("qemu-img", {
    args: ["create", "-f", format, path!, size!],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;
  if (!status.success) {
    console.error(chalk.redBright("Failed to create drive image."));
    Deno.exit(status.code);
  }

  console.log(chalk.greenBright(`Created drive image at ${path}`));
}
