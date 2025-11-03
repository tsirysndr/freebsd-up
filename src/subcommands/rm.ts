import { getInstanceState, removeInstanceState } from "../state.ts";

export default async function (name: string) {
  const vm = await getInstanceState(name);
  if (!vm) {
    console.error(
      `Virtual machine with name or ID ${name} not found.`,
    );
    Deno.exit(1);
  }

  console.log(`Removing virtual machine ${vm.name} (ID: ${vm.id})...`);
  await removeInstanceState(name);
}
