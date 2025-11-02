#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import { Command } from "@cliffy/command";
import {
  createDriveImageIfNeeded,
  downloadIso,
  emptyDiskImage,
  handleInput,
  Options,
  runQemu,
} from "./utils.ts";

if (import.meta.main) {
  await new Command()
    .name("freebsd-up")
    .version("0.1.0")
    .description("Start a FreeBSD virtual machine using QEMU")
    .arguments(
      "[path-or-url-to-iso-or-version:string]",
    )
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
    .option("-d, --drive <path:string>", "Path to VM disk image")
    .option(
      "--disk-format <format:string>",
      "Disk image format (e.g., qcow2, raw)",
      {
        default: "raw",
      },
    )
    .option(
      "-s, --size <size:string>",
      "Size of the disk image to create if it doesn't exist (e.g., 20G)",
      {
        default: "20G",
      },
    )
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
      let isoPath: string | null = resolvedInput;

      if (
        resolvedInput.startsWith("https://") ||
        resolvedInput.startsWith("http://")
      ) {
        isoPath = await downloadIso(resolvedInput, options);
      }

      if (options.drive) {
        await createDriveImageIfNeeded(options);
      }

      if (!input && options.drive && !await emptyDiskImage(options.drive)) {
        isoPath = null;
      }

      await runQemu(isoPath, options);
    })
    .parse(Deno.args);
}
