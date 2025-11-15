import { type Context, Hono } from "hono";
import { Data, Effect, pipe } from "effect";
import { parseParams, parseQueryParams, presentation } from "./utils.ts";
import { getInstanceState } from "../mod.ts";
import { listInstances } from "../state.ts";
import {
  type CommandError,
  findVm,
  killProcess,
  StopCommandError,
  updateToStopped,
  VmNotFoundError,
} from "../subcommands/stop.ts";
import {
  buildQemuArgs,
  createLogsDir,
  setupFirmware,
  startDetachedQemu,
} from "../subcommands/start.ts";
import { MachineParamsSchema } from "../types.ts";

class ParseRequestError extends Data.TaggedError("ParseRequestError")<{
  cause?: unknown;
  message: string;
}> {}

export const handleError = (
  error:
    | VmNotFoundError
    | StopCommandError
    | CommandError
    | ParseRequestError
    | Error,
  c: Context,
) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      return c.json(
        { message: "VM not found", code: "VM_NOT_FOUND" },
        404,
      );
    }
    if (error instanceof StopCommandError) {
      return c.json(
        {
          message: error.message ||
            `Failed to stop VM ${error.vmName}`,
          code: "STOP_COMMAND_ERROR",
        },
        500,
      );
    }

    if (error instanceof ParseRequestError) {
      return c.json(
        {
          message: error.message || "Failed to parse request body",
          code: "PARSE_BODY_ERROR",
        },
        400,
      );
    }

    return c.json(
      { message: error instanceof Error ? error.message : String(error) },
      500,
    );
  });

const parseStartRequest = (c: Context) =>
  Effect.tryPromise({
    try: async () => {
      const body = await c.req.json();
      return MachineParamsSchema.parse(body);
    },
    catch: (error) =>
      new ParseRequestError({
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      }),
  });

const app = new Hono();

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      parseQueryParams(c),
      Effect.flatMap((params) => listInstances(!!params.all)),
      presentation(c),
    ),
  ));

app.post("/", (c) => {
  return c.json({ message: "New machine created" });
});

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getInstanceState(id)),
      presentation(c),
    ),
  ));

app.delete("/:id", (c) => {
  const { id } = c.req.param();
  return c.json({ message: `Machine with ID ${id} deleted` });
});

app.post("/:id/start", (c) =>
  Effect.runPromise(
    pipe(
      Effect.all([parseParams(c), parseStartRequest(c)]),
      Effect.flatMap((
        [{ id }, startRequest],
      ) => Effect.all([findVm(id), Effect.succeed(startRequest)])),
      Effect.flatMap(([vm, startRequest]) =>
        Effect.gen(function* () {
          const firmwareArgs = yield* setupFirmware();
          const qemuArgs = yield* buildQemuArgs({
            ...vm,
            cpu: String(startRequest.cpus ?? vm.cpu),
            memory: startRequest.memory ?? vm.memory,
            portForward: startRequest.portForward
              ? startRequest.portForward.join(",")
              : vm.portForward,
          }, firmwareArgs);
          yield* createLogsDir();
          yield* startDetachedQemu(vm.id, vm, qemuArgs);
          return { ...vm, status: "RUNNING" };
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/:id/stop", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => findVm(id)),
      Effect.flatMap(killProcess),
      Effect.flatMap(updateToStopped),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/:id/restart", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => findVm(id)),
      Effect.flatMap(killProcess),
      Effect.flatMap(updateToStopped),
      Effect.flatMap(() => Effect.all([parseParams(c), parseStartRequest(c)])),
      Effect.flatMap((
        [{ id }, startRequest],
      ) => Effect.all([findVm(id), Effect.succeed(startRequest)])),
      Effect.flatMap(([vm, startRequest]) =>
        Effect.gen(function* () {
          const firmwareArgs = yield* setupFirmware();
          const qemuArgs = yield* buildQemuArgs({
            ...vm,
            cpu: String(startRequest.cpus ?? vm.cpu),
            memory: startRequest.memory ?? vm.memory,
            portForward: startRequest.portForward
              ? startRequest.portForward.join(",")
              : vm.portForward,
          }, firmwareArgs);
          yield* createLogsDir();
          yield* startDetachedQemu(vm.id, vm, qemuArgs);
          return { ...vm, status: "RUNNING" };
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

export default app;
