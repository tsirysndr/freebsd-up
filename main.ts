#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import chalk from "chalk";

const DEFAULT_VERSION = "14.3-RELEASE";

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
  if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
    console.error(
      chalk.greenBright(
        "Usage: freebsd-up [path-to-iso | version | url]",
      ),
    );
    Deno.exit(1);
  }

  if (Deno.args.length === 0) {
    console.log(
      chalk.blueBright(
        `No ISO path provided, defaulting to ${chalk.cyan("FreeBSD")} ${
          chalk.cyan(DEFAULT_VERSION)
        }...`,
      ),
    );
    const url = `https://download.freebsd.org/ftp/releases/ISO-IMAGES/${
      DEFAULT_VERSION.split("-")[0]
    }/FreeBSD-${DEFAULT_VERSION}-amd64-disc1.iso`;
    Deno.args.push(url);
  } else {
    const versionRegex = /^\d{1,2}\.\d{1,2}-(RELEASE|BETA\d*|RC\d*)$/;
    const arg = Deno.args[0];
    if (versionRegex.test(arg)) {
      console.log(
        chalk.blueBright(
          `Detected version ${chalk.cyan(arg)}, constructing download URL...`,
        ),
      );
      const url = `https://download.freebsd.org/ftp/releases/ISO-IMAGES/${
        arg.split("-")[0]
      }/FreeBSD-${arg}-amd64-disc1.iso`;
      Deno.args[0] = url;
    }
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
      "-monitor",
      "none",
      "-chardev",
      "stdio,id=con0,signal=off",
      "-serial",
      "chardev:con0",
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
