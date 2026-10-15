# MRK Printer Bridge Agent

A small, dependency-free Node program that runs **on a computer near the till printer**. It lets
the Mrk Hotels cloud/web POS print to that local thermal printer — the same way E-Zee does — by
acting as the "middleman" between the browser app and the printer.

The agent supports **two transports** (pick one):

- **Network (recommended for Ethernet printers):** the agent opens a raw TCP socket to the
  printer's own IP on port `9100` and streams ESC/POS bytes to it. No driver is needed, and the
  agent can run on Windows, Linux or Mac.
- **Windows queue (USB printers):** the agent spools RAW bytes to a Windows printer installed on
  the same PC (the printer's own vendor driver).

```
Browser (any machine)                        Printer computer
┌──────────────────┐   POST /print  ┌──────────────────────────────┐
│  MRK web app     │ ─────────────► │  mrk-printer-bridge          │
│  sends ESC/POS   │   (network)    │  (this small agent)          │
└──────────────────┘                └──────────────┬───────────────┘
                                                   │
                                network mode ──────┤────── USB/Windows mode
                                                   │
                                                   ▼
                                        thermal receipt printer
```

## Why this is needed

- A **browser cannot open a raw TCP socket**, so it can never talk to a network printer directly —
  the local agent bridges that gap.
- A **browser can only reach USB hardware attached to the machine it is running on** — it can
  never drive a USB printer on another computer, so a local agent is needed there too.
- The agent is physically local to (or on the same network as) the printer and listens on the
  network, so the cloud app can reach it from anywhere.

## Requirements

- **Node.js** (LTS). Install from https://nodejs.org (the ".msi" installer on Windows).
- The printer, and a network path to it:
  - **Network mode:** the printer has a fixed IP (e.g. `192.168.1.200`) reachable from the agent's
    computer. This is the case for an **Ethernet** printer (or a USB printer that also has a LAN
    port).
  - **Windows mode:** the printer is installed in Windows with its driver and set as the
    **default** printer (E-Zee normally already made it the default).


## Setup

1. Copy the whole `printer-bridge` folder to the printer's computer (e.g. `C:\mrk-printer-bridge`).
2. Right-click **`install-start.bat`** and choose **Run as administrator** (run once).
3. Done. The connector installs to start automatically with Windows and starts immediately.

> That is the entire setup — **no commands to type, no Command Prompt needed**. The
> `install-start.bat` helper handles the folder change and the auto-start install for you.

### Manual / command-line alternative

If you prefer (or want to review what runs), you can instead:

1. Open **Command Prompt as Administrator**.
2. `cd C:\mrk-printer-bridge`
3. `node src/server.js`  (start it for this session)
   — and/or — `setup-service.bat`  (install auto-start)

To remove the auto-start later: right-click **`uninstall-service.bat`** → **Run as administrator**.

## Printing to an Ethernet (network) printer

If the printer is connected with a **network cable** instead of USB, the agent talks to it
directly over TCP — no Windows driver and no "Add printer" step.

1. **Give the printer a fixed IP.** The printer almost always listens on TCP port **9100**.
   Most of these printers already ship with a fixed IP (e.g. `192.168.1.100`) — print its
   self-test / network config page to confirm it.
   - **Direct cable** (printer plugged straight into this PC's Ethernet port, not the router):
     run **`setup-printer-link.bat`** as administrator first. It gives the Ethernet port a
     `/32` address and adds a host route so *only* the printer uses that cable, without
     breaking the PC's Wi-Fi. (A plain `192.168.1.10/24` on the Ethernet port would clash with
     the Wi-Fi's `192.168.1.x` and break the internet.)
   - **Through the router/switch:** just make sure the printer's IP is on the same subnet as
     the computer — no extra setup is needed.
2. **Tell the agent the printer's IP** — either:
   - Right-click **`set-network-printer.bat`** and run it, then type the printer IP when asked
     (easiest; it writes `config.local.json` and restarts the helper), **or**
   - Set `PRINTER_HOST` (and, if unusual, `PRINTER_PORT`) as environment variables, **or**
   - Create a file `config.local.json` next to `package.json`:
     ```json
     { "printerHost": "192.168.1.200", "printerPort": 9100 }
     ```
3. **Check it.** Open `http://localhost:9720/health` — it should report `"transport":"network"`
   and the printer address. Then press **Test Print** in MRK.

> With `PRINTER_HOST` set, the agent prints **only** over the network and ignores the Windows
> queue. Delete `config.local.json` (or clear `PRINTER_HOST`) to go back to USB/Windows mode.

## Easiest option: the single-file `.exe` (Windows, no Node install)

If installing Node.js on the printer PC is inconvenient, hand out the **single executable
`mrk-printer-bridge.exe`** instead. It is a copy of Node with this agent packed inside (Node's
Single Executable Application support), so **a double-click is the whole install** — nothing to
install, no commands, no batch files.

1. **Double-click `mrk-printer-bridge.exe`.** A console window opens — leave it open (that is
   the agent running). On first run Windows SmartScreen may warn because the exe is unsigned:
   choose **More info → Run anyway**.
2. Open **`http://localhost:9720/health`** — it should report `"transport":"network"`.
3. In MRK, set the Print Settings endpoint to **`http://localhost:9720`** and press **Test Print**.

The exe has a **default printer baked in** (`192.168.1.100:9100`). To point it at a different
printer, either drop a `config.local.json` next to the exe:

```json
{ "printerHost": "192.168.1.200", "printerPort": 9100 }
```

…or set the `PRINTER_HOST` / `PRINTER_PORT` environment variables. Both override the baked
default (priority: env → `config.local.json` → baked default).

**Auto-start:** put a shortcut to the exe in the Startup folder (Win+R → `shell:startup`).

> The direct-cable setup (`setup-printer-link.bat`, `ping 192.168.1.100`) and the
> `http://localhost:9720` endpoint rule above still apply — the exe only replaces the Node
> install + `node src/server.js` steps.

## Building the single-file exe

The exe is **not** committed to git — it embeds the whole Node runtime (~80 MB). Build it from
source (requires Node.js on the build machine and `npm install` in the repo root for esbuild):

```bash
./printer-bridge/build-sea.sh [DEFAULT_PRINTER_HOST] [DEFAULT_PRINTER_PORT]
```

It bundles `src/sea-entry.js`, downloads the matching Windows `node.exe`, generates a SEA blob
and injects it, writing **`printer-bridge/dist/mrk-printer-bridge.exe`**. The two arguments bake
a default printer at build time; with no arguments it bakes `192.168.1.100:9100`.

## Configuring the app to use it

In MRK, open the cashier **Print Settings** page and choose **Network printer**, then enter
the endpoint:

- **Same PC as the app (recommended):** `http://localhost:9720`
- **Same LAN:** `http://<printer-computer's local IP>:9720` — e.g. `http://192.168.1.50:9720`
- **Remote/Roaming:** a Tailscale address such as `http://100.x.y.z:9720` (see below).

> **Important:** MRK is served over **HTTPS**, and browsers **block** an HTTPS page from calling
> an `http://<lan-ip>:9720` address (mixed content). Only `http://localhost:9720` is allowed.
> So run the agent **on the same PC the till browser runs on** and use `http://localhost:9720`
> as the endpoint.

## Options (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Interface to listen on. Keep `0.0.0.0` to accept LAN + Tailscale. |
| `PORT` | `9720` | Port the agent listens on. |
| `AUTH_TOKEN` | *(empty = off)* | Shared secret. When set, requests must send it in the `X-Auth-Token` header. **Strongly recommended** if the endpoint is reachable beyond your LAN. |
| `PRINTER_HOST` | *(empty)* | **Network mode.** IP/hostname of the network printer (e.g. an Ethernet printer). When set, prints over raw TCP instead of the Windows queue. |
| `PRINTER_PORT` | `9100` | TCP port of the network printer (9100 = the standard "raw" port). |
| `PRINTER_NAME` | *(empty = default)* | **Windows mode.** Print to a specific Windows printer by name instead of the default. |
| `ALLOWED_ORIGIN` | `*` | Restrict which origin may call the agent (CORS). |
| `PRINT_VERBOSE` | (off) | Log each print job to the console. |

Any of these can also be set in a `config.local.json` file next to `package.json` (handy for
the auto-start task, which has no window for typing variables). Environment variables win.

Example with a token:
```bat
set AUTH_TOKEN=my-shared-secret
node src/server.js
```

## API

- `GET /health` — status: `{ ok, platform, transport, printer, auth }` (`transport` is `network`
  or `windows`; `printer` is `host:port` or the Windows queue).
- `POST /print` — body = raw ESC/POS bytes. Returns `{ ok, bytes, printer }`.
  - Requires `X-Auth-Token` header **only if** `AUTH_TOKEN` is set.

## Quick local test

From any machine that can reach the agent, send a bare ESC/POS "initialize + cut":
```bat
curl -X POST --data-binary "@script.bin" http://<agent-endpoint>:9720/print
```
Or from the agent's own folder, just hit `/health` in a browser:
```
http://localhost:9720/health
```

> Tip: in **network mode** you can bypass the agent entirely from the printer's computer to test
> the printer itself — e.g. `Test-NetConnection 192.168.1.200 -Port 9100` (Windows) or
> `nc -vz 192.168.1.200 9100` (Linux/Mac). If the port is open, raw bytes sent there will print.

## Remote access (optional): Tailscale

To print from machines **outside the hotel LAN** (e.g. the owner's laptop, or a different
network), the simplest secure option is **Tailscale** — a free private VPN that puts every
device on one private network.

1. Create a free account at https://tailscale.com and install Tailscale on the **agent's computer**.
2. Install Tailscale on any other device that needs to print (same account).
3. Both devices get a stable `100.x.y.z` address. Use the agent computer's as the Print Settings endpoint.

Because the agent binds to `0.0.0.0`, Tailscale traffic to it just works — and with
`AUTH_TOKEN` set, only callers with the secret can print.

## Run it as a background service (recommended)

This makes the connector **start automatically every time Windows boots**, with no
console window and nothing for anyone to do after switching the PC on.

1. Right-click **`setup-service.bat`** and choose **Run as administrator** (run once).
2. That's it. The connector registers a Windows startup task (`MRKPrinterBridge`)
   and starts immediately.

To stop it and remove it from auto-start later: right-click **`uninstall-service.bat`**
→ **Run as administrator**.

### What happens when the PC is switched off / on

- **PC on + connector running** → receipts print (the normal state after the one-time
  auto-start setup above).
- **PC off** → no printing, from any machine. This matches E-Zee, which also needs its
  PC on.
- **PC on again** → with auto-start installed, the connector comes back up by itself;
  **nothing needs to be configured or run again.**

> Note: printing requires the agent's computer to be on, exactly like E-Zee. To remove even that
> dependency, run the agent on the smallest always-on computer on the network (it needs no
> Windows and no driver in **network mode** — any Linux box, Raspberry Pi, or NAS that can reach
> the printer's IP will do).
