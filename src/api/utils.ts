import { Effect } from "effect";
import type { Context } from "hono";

export const parseQueryParams = (c: Context) => Effect.succeed(c.req.query());

export const parseParams = (c: Context) => Effect.succeed(c.req.param());

export const presentation = (c: Context) =>
  Effect.flatMap((data) => Effect.succeed(c.json(data)));
