import { ctx } from "./context.ts";
import type { VirtualMachine } from "./db.ts";
import type { STATUS } from "./types.ts";

export async function saveInstanceState(vm: VirtualMachine) {
  await ctx.db.insertInto("virtual_machines")
    .values(vm)
    .execute();
}

export async function updateInstanceState(
  name: string,
  status: STATUS,
  pid?: number,
) {
  await ctx.db.updateTable("virtual_machines")
    .set({ status, pid })
    .where((eb) =>
      eb.or([
        eb("name", "=", name),
        eb("id", "=", name),
      ])
    )
    .execute();
}

export async function removeInstanceState(name: string) {
  await ctx.db.deleteFrom("virtual_machines")
    .where((eb) =>
      eb.or([
        eb("name", "=", name),
        eb("id", "=", name),
      ])
    )
    .execute();
}

export async function getInstanceState(
  name: string,
): Promise<VirtualMachine | undefined> {
  const vm = await ctx.db.selectFrom("virtual_machines")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb("name", "=", name),
        eb("id", "=", name),
      ])
    )
    .executeTakeFirst();

  return vm;
}
