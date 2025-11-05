import { Table } from "@cliffy/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { ctx } from "../context.ts";
import type { VirtualMachine } from "../db.ts";

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
    ["NAME", "VCPU", "MEMORY", "STATUS", "PID", "BRIDGE", "PORTS", "CREATED"],
  );

  for (const vm of results) {
    table.push([
      vm.name,
      vm.cpus.toString(),
      vm.memory,
      formatStatus(vm),
      vm.pid?.toString() ?? "-",
      vm.bridge ?? "-",
      formatPorts(vm.portForward),
      dayjs.utc(vm.createdAt).local().fromNow(),
    ]);
  }

  console.log(table.padding(2).toString());
}

function formatStatus(vm: VirtualMachine) {
  switch (vm.status) {
    case "RUNNING":
      return `Up ${
        dayjs.utc(vm.updatedAt).local().fromNow().replace("ago", "")
      }`;
    case "STOPPED":
      return `Exited ${dayjs.utc(vm.updatedAt).local().fromNow()}`;
    default:
      return vm.status;
  }
}

function formatPorts(portForward?: string) {
  if (!portForward) {
    return "-";
  }

  const mappings = portForward.split(",");
  return mappings.map((mapping) => {
    const [hostPort, guestPort] = mapping.split(":");
    return `${hostPort}->${guestPort}`;
  }).join(", ");
}
