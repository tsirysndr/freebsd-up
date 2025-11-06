import _ from "@es-toolkit/es-toolkit/compat";
import chalk from "chalk";
import { Data, Effect, pipe } from "effect";
import type { VirtualMachine } from "../db.ts";
import { getInstanceState, updateInstanceState } from "../state.ts";

class VmNotFoundError extends Data.TaggedError("VmNotFoundError")<{
  name: string;
}> {}

class StopCommandError extends Data.TaggedError("StopCommandError")<{
  vmName: string;
  exitCode: number;
}> {}

class CommandError extends Data.TaggedError("CommandError")<{
  cause?: unknown;
}> {}

const findVm = (name: string) =>
  pipe(
    getInstanceState(name),
    Effect.flatMap((vm) =>
      vm ? Effect.succeed(vm) : Effect.fail(new VmNotFoundError({ name }))
    ),
  );

const logStopping = (vm: VirtualMachine) =>
  Effect.sync(() => {
    console.log(
      `Stopping virtual machine ${chalk.greenBright(vm.name)} (ID: ${
        chalk.greenBright(vm.id)
      })...`,
    );
  });

const killProcess = (vm: VirtualMachine) =>
  Effect.tryPromise({
    try: async () => {
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
      return { vm, status };
    },
    catch: (error) => new CommandError({ cause: error }),
  }).pipe(
    Effect.flatMap(({ vm, status }) =>
      status.success ? Effect.succeed(vm) : Effect.fail(
        new StopCommandError({
          vmName: vm.name,
          exitCode: status.code || 1,
        }),
      )
    ),
  );

const updateToStopped = (vm: VirtualMachine) =>
  pipe(
    updateInstanceState(vm.name, "STOPPED"),
    Effect.map(() => vm),
  );

const logSuccess = (vm: VirtualMachine) =>
  Effect.sync(() => {
    console.log(`Virtual machine ${chalk.greenBright(vm.name)} stopped.`);
  });

const handleError = (
  error: VmNotFoundError | StopCommandError | CommandError | Error,
) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      console.error(
        `Virtual machine with name or ID ${
          chalk.greenBright(error.name)
        } not found.`,
      );
      Deno.exit(1);
    } else if (error instanceof StopCommandError) {
      console.error(
        `Failed to stop virtual machine ${chalk.greenBright(error.vmName)}.`,
      );
      Deno.exit(error.exitCode);
    } else {
      console.error(`An error occurred: ${error}`);
      Deno.exit(1);
    }
  });

const stopEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.tap(logStopping),
    Effect.flatMap(killProcess),
    Effect.flatMap(updateToStopped),
    Effect.tap(logSuccess),
    Effect.catchAll(handleError),
  );

export default async function (name: string) {
  await Effect.runPromise(stopEffect(name));
}
