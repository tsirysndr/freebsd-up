import { LOGS_DIR } from "../constants.ts";

export default async function (name: string, follow: boolean) {
  await Deno.mkdir(LOGS_DIR, { recursive: true });
  const logPath = `${LOGS_DIR}/${name}.log`;

  const cmd = new Deno.Command(follow ? "tail" : "cat", {
    args: [
      ...(follow ? ["-n", "100", "-f"] : []),
      logPath,
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;

  if (!status.success) {
    console.error(`Failed to view logs for virtual machine ${name}.`);
    Deno.exit(status.code);
  }
}
