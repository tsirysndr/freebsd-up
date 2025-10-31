# FreeBSD-Up 🚀

A simple, zero-configuration script to quickly boot FreeBSD ISO images using
QEMU. Perfect for testing, development, or learning FreeBSD without complex
setup.

## ✨ Features

- 🔗 **Download and boot from URLs**: Automatically downloads ISO images from
  remote URLs
- 📁 **Local file support**: Boot from local ISO files
- ⚡ **Zero configuration**: Works out of the box with sensible defaults
- 🖥️ **Serial console**: Configured for headless operation with stdio console
- 🌐 **Network ready**: Pre-configured with SSH port forwarding (host:2222 →
  guest:22)
- 💾 **Smart caching**: Automatically skips re-downloading existing ISO files

## 📋 Prerequisites

Before using FreeBSD-Up, make sure you have:

- **[Deno](https://deno.land/)** - Modern JavaScript/TypeScript runtime
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

### Boot from URL (Recommended)

Download and boot the latest FreeBSD release:

```bash
./main.ts https://download.freebsd.org/ftp/releases/amd64/amd64/ISO-IMAGES/15.0/FreeBSD-15.0-BETA3-amd64-disc1.iso
```

### Boot from Local File

```bash
./main.ts /path/to/your/freebsd.iso
```

### Alternative Execution Methods

If the script isn't executable, you can run it directly with Deno:

```bash
deno run --allow-run --allow-read --allow-env main.ts <iso-path-or-url>
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
- **Console**: Serial console via stdio

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
    // ... other options
  ],
  // ...
});
```

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

**Note**: This tool is designed for development and testing purposes. For
production FreeBSD deployments, consider using proper installation methods.
