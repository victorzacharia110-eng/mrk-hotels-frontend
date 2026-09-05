# MRK Printer Bridge Agent

A small, dependency-free Node program that runs **on the Windows computer that owns the
till printer** (PC-2). It lets the Mrk Hotels cloud/web POS print to that local thermal
printer — the same way E-Zee does — by acting as the "middleman" between the browser app
and the Windows printer driver.

```
Browser (any machine)                        PC-2 (the printer's computer)
┌──────────────────┐   POST /print  ┌──────────────────────────────┐
│  MRK web app     │ ─────────────► │  mrk-printer-bridge  ◄─► Windows  │
│  sends ESC/POS   │   (network)    │  (this small agent)        driver   │
└──────────────────┘                └─────────────────────────────────────┘
                                                     │
                                                    ▼
                                       Romeson RM80ZJ till printer
```

## Why this is needed

- A **browser can only reach USB hardware attached to the machine it is running on** — it
  can never drive a USB printer on another computer.
- The RM80ZJ is a **vendor-driver USB device**, so it does not even appear as a usable port
  in the browser's serial chooser, even on PC-2 itself.
- A **native agent installed on PC-2** closes both gaps: it is physically local to the
  printer, so it talks to the working Windows driver (the same one E-Zee uses), and it
  listens on the network so the cloud app can reach it from anywhere.

## Requirements on PC-2

- **Windows** (this is the machine the RM80ZJ is plugged into).
- **Node.js** (LTS). Install from https://nodejs.org (the ".msi" installer).
- The printer must be installed in Windows with its driver, and set as the **default
  printer** (E-Zee normally already made it the default).

## Setup

1. Copy the whole `printer-bridge` folder to PC-2 (e.g. `C:\mrk-printer-bridge`).
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

## Configuring the app to use it

In MRK, open the cashier **Print Settings** page and choose **Network printer**, then enter
the endpoint:

- **Same LAN:** `http://<PC-2's local IP>:9720` — e.g. `http://192.168.1.50:9720`
- **Remote/Roaming:** a Tailscale address such as `http://100.x.y.z:9720` (see below).

## Options (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Interface to listen on. Keep `0.0.0.0` to accept LAN + Tailscale. |
| `PORT` | `9720` | Port to listen on. |
| `AUTH_TOKEN` | *(empty = off)* | Shared secret. When set, requests must send it in the `X-Auth-Token` header. **Strongly recommended** if the endpoint is reachable beyond your LAN. |
| `PRINTER_NAME` | *(empty = default)* | Print to a specific Windows printer by name instead of the default. |
| `ALLOWED_ORIGIN` | `*` | Restrict which origin may call the agent (CORS). |
| `PRINT_VERBOSE` | (off) | Log each print job to the console. |

Example with a token:
```bat
set AUTH_TOKEN=my-shared-secret
node src/server.js
```

## API

- `GET /health` — status: `{ ok, platform, printer, auth }`.
- `POST /print` — body = raw ESC/POS bytes. Returns `{ ok, bytes, printer }`.
  - Requires `X-Auth-Token` header **only if** `AUTH_TOKEN` is set.

## Quick local test

From any machine that can reach the agent, send a bare ESC/POS "initialize + cut":
```bat
curl -X POST --data-binary "@script.bin" http://<PC-2-endpoint>:9720/print
```
Or from the agent's own folder, just hit `/health` in a browser:
```
http://localhost:9720/health
```

## Remote access (optional): Tailscale

To print from machines **outside the hotel LAN** (e.g. the owner's laptop, or a different
network), the simplest secure option is **Tailscale** — a free private VPN that puts every
device on one private network.

1. Create a free account at https://tailscale.com and install Tailscale on **PC-2**.
2. Install Tailscale on any other device that needs to print (same account).
3. Both devices get a stable `100.x.y.z` address. Use PC-2's as the Print Settings endpoint.

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

> Note: printing requires the till PC (PC-2) to be on, exactly like E-Zee. If the
> client wants printing to work even when that PC is off, the RM80ZJ can later be
> connected over its **LAN** port instead of USB — a separate optional change.
