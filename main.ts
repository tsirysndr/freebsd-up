#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import chalk from "chalk";

async function downloadIso(url: string, outputPath?: string): Promise<string> {
  const filename = url.split("/").pop()!;
  outputPath = outputPath ?? filename;

  if (await Deno.stat(outputPath).catch(() => false)) {
    console.log(
      chalk.yellowBright(
        `File ${outputPath} already exists, skipping download.`,
      ),
    );
    return outputPath;
  }

  const cmd = new Deno.Command("curl", {
    args: ["-L", "-o", outputPath, url],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;
  if (!status.success) {
    console.error(chalk.redBright("Failed to download ISO image."));
    Deno.exit(status.code);
  }

  console.log(chalk.greenBright(`Downloaded ISO to ${outputPath}`));
  return outputPath;
}

if (import.meta.main) {
  if (Deno.args.length !== 1) {
    console.error(
      chalk.greenBright(
        "Usage: deno run --allow-run --allow-read --allow-env main.ts <path-to-iso>",
      ),
    );
    Deno.exit(1);
  }

  let isoPath = Deno.args[0];

  if (
    Deno.args[0].startsWith("https://") || Deno.args[0].startsWith("http://")
  ) {
    isoPath = await downloadIso(Deno.args[0]);
  }

  const cmd = new Deno.Command("qemu-system-x86_64", {
    args: [
      "-enable-kvm",
      "-cpu",
      "host",
      "-m",
      "2G",
      "-smp",
      "2",
      "-cdrom",
      isoPath,
      //"-drive",
      //"file=freebsd-vm.img,format=raw,if=virtio",
      "-netdev",
      "user,id=net0,hostfwd=tcp::2222-:22",
      "-device",
      "e1000,netdev=net0",
      "-nographic",
      "-serial",
      "stdio",
      "-monitor",
      "none",
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await cmd.spawn().status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}
