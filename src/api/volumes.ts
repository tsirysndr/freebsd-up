import { Hono } from "hono";
import { Effect, pipe } from "effect";
import { parseParams, presentation } from "./utils.ts";
import { listVolumes } from "../mod.ts";
import { getVolume } from "../volumes.ts";

const app = new Hono();

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      listVolumes(),
      presentation(c),
    ),
  ));

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getVolume(id)),
      presentation(c),
    ),
  ));

app.post("/", (c) => {
  return c.json({ message: "New volume created" });
});

app.delete("/:id", (c) => {
  const { id } = c.req.param();
  return c.json({ message: `Volume with ID ${id} deleted` });
});

export default app;
