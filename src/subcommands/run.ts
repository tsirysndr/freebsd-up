import { parseFlags } from "@cliffy/flags";
import { Effect, pipe } from "effect";
import type { Image } from "../db.ts";
import { getImage } from "../images.ts";
import { createBridgeNetworkIfNeeded } from "../network.ts";
import { pullImage, PullImageError, setupOrasBinary } from "../oras.ts";
import { type Options, runQemu, validateImage } from "../utils.ts";

const pullImageOnMissing = (
  name: string,
): Effect.Effect<Image, Error, never> =>
  pipe(
    getImage(name),
    Effect.flatMap((img) => {
      if (img) {
        return Effect.succeed(img);
      }
      console.log(`Image ${name} not found locally`);
      return pipe(
        pullImage(name),
        Effect.flatMap(() => getImage(name)),
        Effect.flatMap((pulledImg) =>
          pulledImg ? Effect.succeed(pulledImg) : Effect.fail(
            new PullImageError({ cause: "Failed to pull image" }),
          )
        ),
      );
    }),
  );

const runImage = (image: Image) =>
  Effect.gen(function* () {
    console.log(`Running image ${image.repository}...`);
    const options = mergeFlags(image);
    if (options.bridge) {
      yield* createBridgeNetworkIfNeeded(options.bridge);
    }
    yield* runQemu(null, options);
  });

export default async function (
  image: string,
): Promise<void> {
  await Effect.runPromise(
    pipe(
      Effect.promise(() => setupOrasBinary()),
      Effect.tap(() => validateImage(image)),
      Effect.flatMap(() => pullImageOnMissing(image)),
      Effect.flatMap(runImage),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to run image: ${error.cause} ${image}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}

function mergeFlags(image: Image): Options {
  const { flags } = parseFlags(Deno.args);
  return {
    cpu: flags.cpu ? flags.cpu : "host",
    cpus: flags.cpus ? flags.cpus : 2,
    memory: flags.memory ? flags.memory : "2G",
    image: image.path,
    bridge: flags.bridge,
    portForward: flags.portForward,
    detach: flags.detach,
    install: false,
    diskFormat: image.format,
  };
}
