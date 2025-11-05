import chalk from "chalk";
import _ from "lodash";
import { LOGS_DIR } from "../constants.ts";
import { getInstanceState, updateInstanceState } from "../state.ts";
import {
  safeKillQemu,
  setupFirmwareFilesIfNeeded,
  setupNATNetworkArgs,
} from "../utils.ts";

export default async function (name: string) {
  const vm = await getInstanceState(name);
  if (!vm) {
    console.error(
      `Virtual machine with name or ID ${chalk.greenBright(name)} not found.`,
    );
    Deno.exit(1);
  }

  const success = await safeKillQemu(vm.pid, Boolean(vm.bridge));

  if (!success) {
    console.error(
      `Failed to stop virtual machine ${chalk.greenBright(vm.name)}.`,
    );
    Deno.exit(1);
  }
  await updateInstanceState(vm.id, "STOPPED");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await Deno.mkdir(LOGS_DIR, { recursive: true });
  const logPath = `${LOGS_DIR}/${vm.name}.log`;

  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";

  const qemuArgs = [
    ..._.compact([vm.bridge && qemu]),
    ..._.compact(
      Deno.build.os === "darwin" ? ["-accel", "hvf"] : ["-enable-kvm"],
    ),
    ..._.compact(
      Deno.build.arch === "aarch64" && ["-machine", "virt,highmem=on"],
    ),
    "-cpu",
    vm.cpu,
    "-m",
    vm.memory,
    "-smp",
    vm.cpus.toString(),
    ..._.compact([vm.isoPath && "-cdrom", vm.isoPath]),
    "-netdev",
    vm.bridge
      ? `bridge,id=net0,br=${vm.bridge}`
      : setupNATNetworkArgs(vm.portForward),
    "-device",
    `e1000,netdev=net0,mac=${vm.macAddress}`,
    "-nographic",
    "-monitor",
    "none",
    "-chardev",
    "stdio,id=con0,signal=off",
    "-serial",
    "chardev:con0",
    ...await setupFirmwareFilesIfNeeded(),
    ..._.compact(
      vm.drivePath && [
        "-drive",
        `file=${vm.drivePath},format=${vm.diskFormat},if=virtio`,
      ],
    ),
  ];

  const fullCommand = vm.bridge
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

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await updateInstanceState(vm.id, "RUNNING", qemuPid);

  console.log(
    `${chalk.greenBright(vm.name)} restarted with PID ${
      chalk.greenBright(qemuPid)
    }.`,
  );
  console.log(
    `Logs are being written to ${chalk.blueBright(logPath)}`,
  );

  await new Promise((resolve) => setTimeout(resolve, 2000));

  Deno.exit(0);
}
