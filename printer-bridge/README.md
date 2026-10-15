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

## Finding the printer's IP address

The printer needs a fixed IP the agent can reach. Three ways to find it, easiest first:

1. **Printer self-test page.** Power the printer off, **hold the FEED button**, power it on,
   release after a few seconds. It prints a slip showing the **IP**, whether it is DHCP/static,
   and the **MAC**. This is the printer reporting its own address — the most reliable source.
2. **Router's client list.** If the printer goes through a router/switch, open the router's
   **DHCP / connected-devices** page and find the row whose **MAC matches the one on the
   printer's label** (for the ZyWell Zy-Q822: `00:54:19:2d:ef:7e`). The row shows its IP.
3. **From the till PC.** If the printer is on the same subnet, use the setup page's
   **Detect printers** button (scans the local network for port 9100), or from a terminal:
   - Windows: `arp -a` (look for the MAC), then `Test-NetConnection <ip> -Port 9100`.
   - Linux/Mac: `nmap -p 9100 192.168.1.0/24`, or `nc -vz <ip> 9100`.
   A host with **TCP port 9100 open** is almost certainly the printer.

> For a **direct-cable** setup (printer plugged straight into the PC), the address is the
> printer's **static default, `192.168.1.100`** — no discovery needed. Confirm it with the
> self-test page if unsure.

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
2. **Tell the agent the printer's IP** — easiest is the built-in **setup page**:
   - Open **`http://localhost:9720/`** in a browser and click **Detect printers** to find it
     automatically (it scans the local network for the printer's port and shows the MAC of each
     hit), or type the printer's **IP address** (and port, if not `9100`) yourself, then click
     **Save**. It applies **immediately** — no restart, no rebuild — and is remembered in
     `config.local.json`.
   - *(Alternatives, same result: run **`set-network-printer.bat`** which writes
     `config.local.json` for you, set the `PRINTER_HOST` / `PRINTER_PORT` environment variables,
     or edit `config.local.json` by hand:
     `{ "printerHost": "192.168.1.200", "printerPort": 9100 }`.)*
3. **Check it.** Open `http://localhost:9720/health` — it should report `"transport":"network"`
   and the printer address. Use **Test print** on the setup page, or **Test Print** in MRK.

> With `PRINTER_HOST` set, the agent prints **only** over the network and ignores the Windows
> queue. Delete `config.local.json` (or clear `PRINTER_HOST`) to go back to USB/Windows mode.

## Easiest option: the single-file `.exe` (Windows, no Node install)

If installing Node.js on the printer PC is inconvenient, hand out the **single executable
`mrk-printer-bridge.exe`** instead. It is a copy of Node with this agent packed inside (Node's
Single Executable Application support), so **a double-click is the whole install** — nothing to
install, no commands, no batch files, no admin rights for the normal case.

### What a non-technical person does

1. **Double-click `mrk-printer-bridge.exe`.** On first run Windows SmartScreen may warn because
   the exe is unsigned: choose **More info → Run anyway** (this warning appears once).
2. The first run **installs itself**: it copies the exe to
   `%LOCALAPPDATA%\MRKPrinterBridge\mrk-printer-bridge.exe` and registers itself to start with
   Windows (per-user auto-start — **no administrator prompt**), then relaunches from there. A
   console window opens; leave it open, that is the agent running.
3. The **setup page opens by itself** in the browser (**`http://localhost:9720/`**). It walks
   them through it:
   - Click **Detect printers** — it scans the local network for the printer's port and lists
     each candidate with its MAC (so it can be matched to the sticker on the printer).
   - Click the printer in the list, then **Save**, then **Test print**.
4. In MRK, set the Print Settings endpoint to **`http://localhost:9720`**.

**If the printer is plugged straight into this PC** (not into the router), detection finds
nothing. The page then shows a **"Fix direct-cable connection"** box — clicking it gives the
wired port a one-time network fix. This is the only step that can ask for permission: Windows
shows a single UAC prompt, and they click **Yes**. (The fix routes just the printer's IP
through the wired port, so the PC's Wi-Fi keeps working.)

The printer address is **fully adjustable at run time** — a different network just types a
different IP; there is nothing to rebuild and no file to hand-edit. Saving writes
`config.local.json` **next to the exe**. A `PRINTER_HOST` / `PRINTER_PORT` environment variable,
if one is set, still wins over it (priority: env → `config.local.json` → baked default).

> Set `MRK_NO_BROWSER=1` to stop the setup page opening automatically on first run, or
> `MRK_SKIP_INSTALL=1` to skip the self-install (run it straight from wherever it is).

**Auto-start** is installed automatically on first run. To remove it later: `Win+R` →
`shell:startup` and delete the `MRKPrinterBridge` shortcut, or delete the `MRKPrinterBridge`
value from `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

> The exe replaces the Node install + `node src/server.js` steps; the direct-cable fix and the
> `http://localhost:9720` endpoint rule are handled from inside the setup page.

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
| `MRK_NO_BROWSER` | (off) | Set to `1` to stop the single-file `.exe` opening the setup page automatically on first run. |

Any of these can also be set in a `config.local.json` file — next to the `.exe` for the
single-file build, or next to `package.json` for a normal node run (handy for the auto-start
task, which has no window for typing variables). Environment variables win. The easiest way to
write it is the setup page at `http://localhost:9720/`.

Example with a token:
```bat
set AUTH_TOKEN=my-shared-secret
node src/server.js
```

## API

- `GET /` — the **setup page** (HTML): set the printer's IP/port and test-print from a browser.
- `GET /health` — status: `{ ok, platform, transport, printer, auth, version }` (`transport` is
  `network` or `windows`; `printer` is `host:port` or the Windows queue).
- `GET /config` — current printer settings: `{ ok, printerHost, printerPort, transport, configPath }`.
- `POST /config` — JSON body `{ "printerHost": "...", "printerPort": 9100 }`; saves to
  `config.local.json` and applies it **immediately**. Requires `X-Auth-Token` only if `AUTH_TOKEN` is set.
- `GET /discover` — scans the local subnet(s) for printers (TCP **9100** open) and returns
  `{ ok, localAddresses, subnets, scanned, printers: [{ ip, ports, mac }] }`. Used by the setup page's **Detect printers** button.
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
