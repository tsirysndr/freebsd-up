# FreeBSD-Up 🚀

A simple, zero-configuration script to quickly boot FreeBSD ISO images using
QEMU. Perfect for testing, development, or learning FreeBSD without complex
setup.

![Preview](./preview.png)

## ✨ Features

- 🔗 **Download and boot from URLs**: Automatically downloads ISO images from
  remote URLs
- 📁 **Local file support**: Boot from local ISO files
- 🏷️ **Version shortcuts**: Simply specify a version like `14.3-RELEASE` to
  auto-download
- 🎯 **Smart defaults**: Run without arguments to boot the latest stable release
  (FreeBSD 14.3-RELEASE)
- ⚡ **Zero configuration**: Works out of the box with sensible defaults
- 🖥️ **Serial console**: Configured for headless operation with stdio console
- 🌐 **Network ready**: Pre-configured with SSH port forwarding (host:2222 →
  guest:22)
- 💾 **Smart caching**: Automatically skips re-downloading existing ISO files
- 🆘 **Help support**: Built-in help with `--help` or `-h` flags

## 📋 Prerequisites

Before using FreeBSD-Up, make sure you have:

- **[Deno](https://deno.com)** - Modern JavaScript/TypeScript runtime
- **[QEMU](https://www.qemu.org/)** - Hardware virtualization
- **KVM support** (Linux) - For hardware acceleration (optional but recommended)

### Installation on Common Systems

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install qemu-system-x86 qemu-kvm
curl -fsSL https://deno.land/install.sh | sh
```

**Fedora:**

```bash
sudo dnf install qemu qemu-kvm
curl -fsSL https://deno.land/install.sh | sh
```

**macOS:**

```bash
brew install qemu deno
```

## 🚀 Quick Start

### Default Usage (Easiest)

Simply run without any arguments to boot the latest stable FreeBSD release:

```bash
./main.ts
```

This will automatically download and boot FreeBSD 14.3-RELEASE.

### Boot with Version Shortcut

Specify just a version to auto-download and boot:

```bash
./main.ts 14.3-RELEASE
./main.ts 15.0-BETA3
./main.ts 13.4-RELEASE
```

### Boot from URL

Download and boot from a specific URL:

```bash
./main.ts https://download.freebsd.org/ftp/releases/amd64/amd64/ISO-IMAGES/15.0/FreeBSD-15.0-BETA3-amd64-disc1.iso
```

### Boot from Local File

```bash
./main.ts /path/to/your/freebsd.iso
```

### Get Help

```bash
./main.ts --help
# or
./main.ts -h
```

### Alternative Execution Methods

If the script isn't executable, you can run it directly with Deno:

```bash
deno run --allow-run --allow-read --allow-env main.ts [options]
```

## 🖥️ Console Setup

When FreeBSD boots, you'll see the boot menu. For the best experience with the
serial console:

1. **Select option `3. Escape to loader prompt`**
2. **Configure console output:**
   ```
   set console="comconsole"
   boot
   ```

This enables proper console redirection to your terminal.

## ⚙️ VM Configuration

The script creates a VM with the following specifications:

- **CPU**: Host CPU with KVM acceleration
- **Memory**: 2GB RAM
- **Cores**: 2 virtual CPUs
- **Network**: User mode networking with SSH forwarding
- **Console**: Enhanced serial console via stdio with proper signal handling
- **Default Version**: FreeBSD 14.3-RELEASE (when no arguments provided)

## 🔧 Customization

To modify VM settings, edit the QEMU arguments in `main.ts`:

```typescript
const cmd = new Deno.Command("qemu-system-x86_64", {
  args: [
    "-enable-kvm",
    "-cpu",
    "host",
    "-m",
    "2G", // Change memory
    "-smp",
    "2", // Change CPU cores
    "-chardev",
    "stdio,id=con0,signal=off", // Enhanced console handling
    "-serial",
    "chardev:con0",
    // ... other options
  ],
  // ...
});
```

### Supported Version Formats

The script automatically recognizes and handles these version formats:

- `14.3-RELEASE` - Stable releases
- `15.0-BETA3` - Beta versions
- `13.4-RC1` - Release candidates
- Any format matching: `X.Y-RELEASE|BETAX|RCX`

To change the default version when no arguments are provided, modify the
`DEFAULT_VERSION` constant in `main.ts`.

## 📁 Project Structure

```
freebsd-up/
├── main.ts          # Main script
├── deno.json        # Deno configuration
└── README.md        # This file
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source. Check the repository for license details.

## 🔗 Useful Links

- [FreeBSD Downloads](https://www.freebsd.org/where/)
- [QEMU Documentation](https://www.qemu.org/docs/master/)
- [Deno Manual](https://docs.deno.com/runtime/)

---

> [!NOTE]
>
> This tool is designed for development and testing purposes. For production
> FreeBSD deployments, consider using proper installation methods.
