import _ from "@es-toolkit/es-toolkit/compat";
import chalk from "chalk";
import { getInstanceState, updateInstanceState } from "../state.ts";

export default async function (name: string) {
  const vm = await getInstanceState(name);
  if (!vm) {
    console.error(
      `Virtual machine with name or ID ${chalk.greenBright(name)} not found.`,
    );
    Deno.exit(1);
  }

  console.log(
    `Stopping virtual machine ${chalk.greenBright(vm.name)} (ID: ${
      chalk.greenBright(vm.id)
    })...`,
  );

  const cmd = new Deno.Command(vm.bridge ? "sudo" : "kill", {
    args: [
      ..._.compact([vm.bridge && "kill"]),
      "-TERM",
      vm.pid.toString(),
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;

  if (!status.success) {
    console.error(
      `Failed to stop virtual machine ${chalk.greenBright(vm.name)}.`,
    );
    Deno.exit(status.code);
  }

  await updateInstanceState(vm.name, "STOPPED");

  console.log(`Virtual machine ${chalk.greenBright(vm.name)} stopped.`);
}
