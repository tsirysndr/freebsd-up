import { Table } from "@cliffy/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { ctx } from "../context.ts";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export default async function (all: boolean) {
  const results = await ctx.db.selectFrom("virtual_machines")
    .selectAll()
    .where((eb) => {
      if (all) {
        return eb("id", "!=", "");
      }
      return eb("status", "=", "RUNNING");
    })
    .execute();

  const table: Table = new Table(
    ["NAME", "VCPU", "MEMORY", "STATUS", "PID", "BRIDGE", "MAC", "CREATED"],
  );

  for (const vm of results) {
    table.push([
      vm.name,
      vm.cpus.toString(),
      vm.memory,
      vm.status,
      vm.pid?.toString() ?? "-",
      vm.bridge ?? "-",
      vm.macAddress,
      dayjs.utc(vm.createdAt).local().fromNow(),
    ]);
  }

  console.log(table.padding(2).toString());
}
