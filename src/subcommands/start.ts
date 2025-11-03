import _ from "lodash";
import { getInstanceState, updateInstanceState } from "../state.ts";

export default async function (name: string) {
  const vm = await getInstanceState(name);
  if (!vm) {
    console.error(
      `Virtual machine with name or ID ${name} not found.`,
    );
    Deno.exit(1);
  }

  console.log(`Starting virtual machine ${vm.name} (ID: ${vm.id})...`);

  const cmd = new Deno.Command(vm.bridge ? "sudo" : "qemu-system-x86_64", {
    args: [
      ..._.compact([vm.bridge && "qemu-system-x86_64"]),
      "-enable-kvm",
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
        : "user,id=net0,hostfwd=tcp::2222-:22",
      "-device",
      `e1000,netdev=net0,mac=${vm.macAddress}`,
      "-display",
      "none",
      "-vga",
      "none",
      "-monitor",
      "none",
      "-chardev",
      "stdio,id=con0,signal=off",
      "-serial",
      "chardev:con0",
      ..._.compact(
        vm.drivePath && [
          "-drive",
          `file=${vm.drivePath},format=${vm.diskFormat},if=virtio`,
        ],
      ),
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  await updateInstanceState(name, "RUNNING", cmd.pid);

  const status = await cmd.status;

  await updateInstanceState(name, "STOPPED", cmd.pid);

  if (!status.success) {
    Deno.exit(status.code);
  }
}
