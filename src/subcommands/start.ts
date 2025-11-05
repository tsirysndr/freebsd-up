import _ from "lodash";
import { LOGS_DIR } from "../constants.ts";
import { getInstanceState, updateInstanceState } from "../state.ts";
import { setupFirmwareFilesIfNeeded, setupNATNetworkArgs } from "../utils.ts";

export default async function (name: string, detach: boolean = false) {
  const vm = await getInstanceState(name);
  if (!vm) {
    console.error(
      `Virtual machine with name or ID ${name} not found.`,
    );
    Deno.exit(1);
  }

  console.log(`Starting virtual machine ${vm.name} (ID: ${vm.id})...`);

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

  if (detach) {
    await Deno.mkdir(LOGS_DIR, { recursive: true });
    const logPath = `${LOGS_DIR}/${vm.name}.log`;

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

    await updateInstanceState(name, "RUNNING", qemuPid);

    console.log(
      `Virtual machine ${vm.name} started in background (PID: ${qemuPid})`,
    );
    console.log(`Logs will be written to: ${logPath}`);

    // Exit successfully while keeping VM running in background
    Deno.exit(0);
  } else {
    const cmd = new Deno.Command(vm.bridge ? "sudo" : qemu, {
      args: qemuArgs,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const child = cmd.spawn();
    await updateInstanceState(name, "RUNNING", child.pid);

    const status = await child.status;

    await updateInstanceState(name, "STOPPED", child.pid);

    if (!status.success) {
      Deno.exit(status.code);
    }
  }
}
