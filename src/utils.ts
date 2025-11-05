import { createId } from "@paralleldrive/cuid2";
import chalk from "chalk";
import _ from "lodash";
import Moniker from "moniker";
import { LOGS_DIR } from "./constants.ts";
import { generateRandomMacAddress } from "./network.ts";
import { saveInstanceState, updateInstanceState } from "./state.ts";

const DEFAULT_VERSION = "14.3-RELEASE";

export interface Options {
  output?: string;
  cpu: string;
  cpus: number;
  memory: string;
  image?: string;
  diskFormat: string;
  size: string;
  bridge?: string;
  portForward?: string;
  detach?: boolean;
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

  if (options.image && await Deno.stat(options.image).catch(() => false)) {
    const driveSize = await du(options.image);
    if (driveSize > 10) {
      console.log(
        chalk.yellowBright(
          `Drive image ${options.image} is not empty (size: ${driveSize} KB), skipping ISO download to avoid overwriting existing data.`,
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

export function setupPortForwardingArgs(portForward?: string): string {
  if (!portForward) {
    return "";
  }

  const forwards = portForward.split(",").map((pair) => {
    const [hostPort, guestPort] = pair.split(":");
    return `hostfwd=tcp::${hostPort}-:${guestPort}`;
  });

  return forwards.join(",");
}

export function setupNATNetworkArgs(portForward?: string): string {
  if (!portForward) {
    return "user,id=net0";
  }

  const portForwarding = setupPortForwardingArgs(portForward);
  return `user,id=net0,${portForwarding}`;
}

export async function runQemu(
  isoPath: string | null,
  options: Options,
): Promise<void> {
  const macAddress = generateRandomMacAddress();

  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";

  const qemuArgs = [
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
      : setupNATNetworkArgs(options.portForward),
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
      options.image && [
        "-drive",
        `file=${options.image},format=${options.diskFormat},if=virtio`,
      ],
    ),
  ];

  const name = Moniker.choose();

  if (options.detach) {
    await Deno.mkdir(LOGS_DIR, { recursive: true });
    const logPath = `${LOGS_DIR}/${name}.log`;

    const fullCommand = options.bridge
      ? `sudo ${qemu} ${
        qemuArgs.slice(1).join(" ")
      } >> "${logPath}" 2>&1 & echo $!`
      : `${qemu} ${qemuArgs.join(" ")} >> "${logPath}" 2>&1 & echo $!`;

    const cmd = new Deno.Command("sh", {
      args: ["-c", fullCommand],
      stdin: "null",
      stdout: "piped",
    });

    const { stdout } = await cmd.spawn().output();
    const qemuPid = parseInt(new TextDecoder().decode(stdout).trim(), 10);

    await saveInstanceState({
      id: createId(),
      name,
      bridge: options.bridge,
      macAddress,
      memory: options.memory,
      cpus: options.cpus,
      cpu: options.cpu,
      diskSize: options.size,
      diskFormat: options.diskFormat,
      portForward: options.portForward,
      isoPath: isoPath ? Deno.realPathSync(isoPath) : undefined,
      drivePath: options.image ? Deno.realPathSync(options.image) : undefined,
      version: DEFAULT_VERSION,
      status: "RUNNING",
      pid: qemuPid,
    });

    console.log(
      `Virtual machine ${name} started in background (PID: ${qemuPid})`,
    );
    console.log(`Logs will be written to: ${logPath}`);

    // Exit successfully while keeping VM running in background
    Deno.exit(0);
  } else {
    const cmd = new Deno.Command(options.bridge ? "sudo" : qemu, {
      args: qemuArgs,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
      .spawn();

    await saveInstanceState({
      id: createId(),
      name,
      bridge: options.bridge,
      macAddress,
      memory: options.memory,
      cpus: options.cpus,
      cpu: options.cpu,
      diskSize: options.size,
      diskFormat: options.diskFormat,
      portForward: options.portForward,
      isoPath: isoPath ? Deno.realPathSync(isoPath) : undefined,
      drivePath: options.image ? Deno.realPathSync(options.image) : undefined,
      version: DEFAULT_VERSION,
      status: "RUNNING",
      pid: cmd.pid,
    });

    const status = await cmd.status;

    await updateInstanceState(name, "STOPPED");

    if (!status.success) {
      Deno.exit(status.code);
    }
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

export async function safeKillQemu(
  pid: number,
  useSudo: boolean = false,
): Promise<boolean> {
  const killArgs = useSudo
    ? ["sudo", "kill", "-TERM", pid.toString()]
    : ["kill", "-TERM", pid.toString()];

  const termCmd = new Deno.Command(killArgs[0], {
    args: killArgs.slice(1),
    stdout: "null",
    stderr: "null",
  });

  const termStatus = await termCmd.spawn().status;

  if (termStatus.success) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const checkCmd = new Deno.Command("kill", {
      args: ["-0", pid.toString()],
      stdout: "null",
      stderr: "null",
    });

    const checkStatus = await checkCmd.spawn().status;
    if (!checkStatus.success) {
      return true;
    }
  }

  const killKillArgs = useSudo
    ? ["sudo", "kill", "-KILL", pid.toString()]
    : ["kill", "-KILL", pid.toString()];

  const killCmd = new Deno.Command(killKillArgs[0], {
    args: killKillArgs.slice(1),
    stdout: "null",
    stderr: "null",
  });

  const killStatus = await killCmd.spawn().status;
  return killStatus.success;
}

export async function createDriveImageIfNeeded(
  {
    image: path,
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
