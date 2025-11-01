#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import { Command } from "@cliffy/command";
import chalk from "chalk";

const DEFAULT_VERSION = "14.3-RELEASE";

interface Options {
  output?: string;
  cpu: string;
  cpus: number;
  memory: string;
}

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

function constructDownloadUrl(version: string): string {
  return `https://download.freebsd.org/ftp/releases/ISO-IMAGES/${
    version.split("-")[0]
  }/FreeBSD-${version}-amd64-disc1.iso`;
}

async function runQemu(isoPath: string, options: Options): Promise<void> {
  const cmd = new Deno.Command("qemu-system-x86_64", {
    args: [
      "-enable-kvm",
      "-cpu",
      options.cpu,
      "-m",
      options.memory,
      "-smp",
      options.cpus.toString(),
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

function handleInput(input?: string): string {
  if (!input) {
    console.log(
      chalk.blueBright(
        `No ISO path provided, defaulting to ${chalk.cyan("FreeBSD")} ${
          chalk.cyan(DEFAULT_VERSION)
        }...`,
      ),
    );
    return constructDownloadUrl(DEFAULT_VERSION);
  }

  const versionRegex = /^\d{1,2}\.\d{1,2}-(RELEASE|BETA\d*|RC\d*)$/;

  if (versionRegex.test(input)) {
    console.log(
      chalk.blueBright(
        `Detected version ${chalk.cyan(input)}, constructing download URL...`,
      ),
    );
    return constructDownloadUrl(input);
  }

  return input;
}

if (import.meta.main) {
  await new Command()
    .name("freebsd-up")
    .version("0.1.0")
    .description("Start a FreeBSD virtual machine using QEMU")
    .arguments("[path-to-iso-or-version:string]")
    .option("-o, --output <path:string>", "Output path for downloaded ISO")
    .option("-c, --cpu <type:string>", "Type of CPU to emulate", {
      default: "host",
    })
    .option("-C, --cpus <number:number>", "Number of CPU cores", {
      default: 2,
    })
    .option("-m, --memory <size:string>", "Amount of memory for the VM", {
      default: "2G",
    })
    .example(
      "Default usage",
      "freebsd-up",
    )
    .example(
      "Specific version",
      "freebsd-up 14.3-RELEASE",
    )
    .example(
      "Local ISO file",
      "freebsd-up /path/to/freebsd.iso",
    )
    .example(
      "Download URL",
      "freebsd-up https://download.freebsd.org/ftp/releases/ISO-IMAGES/14.3/FreeBSD-14.3-RELEASE-amd64-disc1.iso",
    )
    .action(async (options: Options, input?: string) => {
      const resolvedInput = handleInput(input);
      let isoPath = resolvedInput;

      if (
        resolvedInput.startsWith("https://") ||
        resolvedInput.startsWith("http://")
      ) {
        isoPath = await downloadIso(resolvedInput, options.output);
      }

      await runQemu(isoPath, {
        cpu: options.cpu,
        memory: options.memory,
        cpus: options.cpus,
      });
    })
    .parse(Deno.args);
}
