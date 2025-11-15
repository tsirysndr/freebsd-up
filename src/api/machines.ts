import { Hono } from "hono";
import { Effect, pipe } from "effect";
import {
  handleError,
  parseParams,
  parseQueryParams,
  parseStartRequest,
  presentation,
} from "./utils.ts";
import { getInstanceState } from "../mod.ts";
import { listInstances } from "../state.ts";
import { findVm, killProcess, updateToStopped } from "../subcommands/stop.ts";
import {
  buildQemuArgs,
  createLogsDir,
  setupFirmware,
  startDetachedQemu,
} from "../subcommands/start.ts";

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
