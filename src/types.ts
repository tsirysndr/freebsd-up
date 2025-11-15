import z from "@zod/zod";

export type STATUS = "RUNNING" | "STOPPED";

export const MachineParamsSchema = z.object({
  portForward: z.array(z.string().regex(/^\d+:\d+$/)).optional(),
  cpu: z.string().optional(),
  cpus: z.number().min(1).optional(),
  memory: z.string().regex(/^\d+(M|G)$/).optional(),
});

export type MachineParams = z.infer<typeof MachineParamsSchema>;
