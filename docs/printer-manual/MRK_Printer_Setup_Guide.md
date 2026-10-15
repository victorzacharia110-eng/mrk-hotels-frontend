# The whole job in five steps

<div class="quickref" markdown="1">

Follow these five steps and your printer is ready. Each one is explained slowly, further down.

1. **Plug in** the printer and switch it on.
2. **Add the printer to your computer** — Part 2 (Windows), Part 3 (Mac) or Part 4 (Linux).
3. **Print a test page** to prove the computer can see the printer.
4. **Install the MRK printer helper** on the computer the printer is plugged into.
5. **In MRK**, open *Printer Settings*, choose *Network printer*, paste the address, press *Test Print*.

</div>

---

# What is CUPS? (in plain words)

**CUPS is the printing manager built into Mac and Linux.** Think of it as the front desk of a hotel: you tell it about the printer **once**, and from then on it takes every receipt and hands it to the printer in the language the printer understands.

On **Windows** the same job is done by Windows itself, so you do not install CUPS there — you simply add the printer in Windows. This guide shows you both, in plain language.

<div class="callout tip" markdown="1">
<div class="callout-title">Why are we not using "Serial"?</div>
The earlier **Serial** method tried to talk to the printer directly, and it could not find your printer. CUPS (and Windows' own printer system) uses the printer's proper **driver**, so it sees the printer correctly. This is the reliable route — and it is already built into your computer, so there is nothing extra to buy.
</div>

---

# Before you start

Check that you have everything on this list. Keep the printer switched on and the paper roll loaded the whole time.

| What you need | A little more detail |
| --- | --- |
| The receipt printer | Your thermal receipt printer, e.g. the Romeson RM80ZJ or similar. |
| The power cable | Plugged into a working wall socket. |
| The USB cable (or network cable) | Connects the printer to the computer. |
| The computer | The one the printer is plugged into. Keep it switched on to print. |
| Chrome or Edge browser | Any modern browser works for this guide. |
| About 15 minutes | Pour a cup of tea first. |

<div class="callout note" markdown="1">
<div class="callout-title">Not sure which computer to use?</div>
Use the computer that the printer's cable is plugged into. We call it **"the printer's computer"** below.
</div>

---

# Part 1 — Plug in the printer {: .part }

<div class="steps" markdown="1">

1. Put the printer on a stable surface near the computer.
2. Plug the **power cable** into the printer and the wall, then press the printer's power button. The light should come on.
3. Load the **paper roll** and close the lid.
4. Plug the **USB cable** into the printer and into the computer. (If you use a network cable instead, plug it in and skip the USB.)
5. Leave everything switched on.

</div>

<div class="callout tip" markdown="1">
<div class="callout-title">Tip</div>
If the printer has a small self-test button, you can press it once to print a test slip. That proves the printer itself is healthy before we set up the computer.
</div>

<div class="callout note" markdown="1">
<div class="callout-title">Using a network (Ethernet) cable instead of USB</div>
Some printers — including the one in this hotel — have a **network socket** as well as USB. You can plug the printer into the network instead of a computer's USB port. When you do, the printer needs its own **fixed IP address** (for example `192.168.1.200`), and the helper is told that address so it can send receipts over the cable. Receipt printers almost always listen on port **9100**. The helper's **set-network-printer.bat** does this for you (Part 5).
</div>

---

# Part 2 — Windows (the printer's computer) {: .part }

<div class="os-head win" markdown="1">

<span class="badge win">Windows</span>

Windows has its **own** printing system, so you do **not** install CUPS here. You simply add the printer, and Windows does the rest.

</div>

<div class="steps" markdown="1">

1. Click **Start**, then type **Printers & scanners** and open it.
2. Click **Add device** (or **Add a printer or scanner**).
3. Wait a moment while Windows looks for the printer.
4. If your printer appears in the list, click **Add device** next to it.
5. If it does **not** appear, click **Add manually** and choose one of these:
   - **Add a printer using an IP address or hostname** — for a printer connected by network cable.
   - **Add a local printer or network printer with manual settings** — for a USB printer.
6. Follow the prompts. Windows will install the **driver** (the printer's software).
7. When it finishes, open **Printers & scanners**, click your printer, and press **Print test page**.

</div>

<div class="callout important" markdown="1">
<div class="callout-title">If Windows asks for a driver, or the printer is shared</div>
Use the disc or USB stick that came with the printer, or download the driver from the maker's website. If the printer is shared from a **Linux or Mac** computer, choose **Add manually → Add a printer using an IP address or hostname** and type the shared address your support team gives you (it looks like `http://192.168.1.50:631/printers/ReceiptPrinter`).
</div>

---

# Part 3 — Mac {: .part }

<div class="os-head mac" markdown="1">

<span class="badge mac">macOS</span>

Mac computers are **powered by CUPS inside**. The friendly screen below is just the easy face of CUPS.

</div>

<div class="steps" markdown="1">

1. Click the **Apple menu** (top-left) → **System Settings**.
2. Open **Printers & Scanners**.
3. Click **Add Printer, Scanner, or Fax…**
4. Find your printer in the list on the left (it usually appears by name, e.g. "Romeson RM80ZJ"). Click it.
5. Check the **Use** box says the printer's name. Click **Add**.
6. The printer now appears in the list. Make sure it is set as the **default** (right-click → Set Default).
7. Click **Print Test Page** to try it.

</div>

---

# Part 4 — Linux (the CUPS way) {: .part }

<div class="os-head linux" markdown="1">

<span class="badge linux">Linux</span>

On Linux, CUPS is the printer system, and it has its own simple web page you can open in your browser.

</div>

<div class="steps" markdown="1">

1. Make sure the printer is plugged in and switched on (Part 1).
2. Open **Chrome** or **Edge** and type this address, then press Enter: **http://localhost:631**
3. Click the **Administration** tab at the top.
4. Click the **Add Printer** button.
5. If a small box asks for a **username** and **password**, type your computer's own login (the one you use to sign in). Then Continue.
6. Under **Local Printers**, click your printer's name. If you do not see it, choose:
   - **AppSocket/HP JetDirect** — for a printer plugged in by network cable.
   - **LPD/LPR Host or Printer** — another common network option.
   Then type the printer's address and click Continue.
7. In **Name**, type **ReceiptPrinter**. You can also fill in Description and Location.
8. Tick the box **Share This Printer**.
9. Click **Continue**.
10. For **Make**, choose **Raw** (this is the best choice for receipt printers). Click **Continue**.
11. On the **Set Default Options** page, choose the paper size for the roll (look for an **80mm** or *Roll* size). Click **Set Default Options**.
12. You are back on the **Printers** page. Click your printer, then **Maintenance → Print Test Page**.

</div>

<div class="callout important" markdown="1">
<div class="callout-title">Important</div>
When CUPS asks for a password, it means **your computer's own username and password** — not a new password and not your MRK password. If you never set one, ask whoever set up the computer.
</div>

<div class="callout tip" markdown="1">
<div class="callout-title">Make it the main printer</div>
On the **Printers** page, open your printer and click **Set As Server Default**. That way it is used automatically.
</div>

---

# Part 5 — Install the MRK printer helper (all computers) {: .part }

<div class="os-head all" markdown="1">

<span class="badge all">All systems</span>

The **helper** (we also call it the **bridge**) lives on the printer's computer. It quietly passes each receipt from MRK to the printer. You install it **once**.

</div>

<div class="steps" markdown="1">

1. On the printer's computer, open MRK → **Printer Settings → Setup guide & printer helper** and click **Printer helper (printer-bridge.zip)**. Then **unzip** it (for example to `C:\mrk-printer-bridge`).
2. **On Windows:** right-click the file **install-start.bat** and choose **Run as administrator**. This is a one-time job.
3. That's it. The helper starts with the computer every time it is switched on — nothing else to click.

</div>

<div class="callout note" markdown="1">
<div class="callout-title">If the printer uses a network (Ethernet) cable</div>
Do the three steps above first, then **right-click `set-network-printer.bat`** and run it. Type the printer's IP address when asked (press Enter to accept port `9100`). The helper then prints straight to the printer over the network — no USB and no Windows driver needed.
</div>

<div class="callout note" markdown="1">
<div class="callout-title">On Mac and Linux</div>
Your MRK support team will give you the matching helper for your system. The idea is exactly the same: start it once and leave it running in the background.
</div>

---

# Part 6 — Tell MRK to use the printer {: .part }

<div class="steps" markdown="1">

1. Sign in to **MRK Hotels**.
2. Open the **cashier** area, then open **Printer Settings**.
3. In the **Add printer** row, choose **Network bridge agent**.
4. In the address box, type the address of the printer's computer, for example:
   **http://192.168.1.50:9720**
5. Click **Add**.
6. Press **Test Print**. A small receipt should come out of the printer.

</div>

<div class="callout tip" markdown="1">
<div class="callout-title">How to find the computer's address (its "IP address")</div>
**Windows:** Settings → **Network & internet** → click your connection → **Properties** → find **IPv4 address**.
**Mac:** System Settings → **Network** → **Details** → **IP Address**.
**Linux:** System Settings → **Network** → the address shown for your connection.
It looks like four numbers, such as `192.168.1.50`. Use it in the step above, followed by `:9720`.
</div>

---

# Part 7 — If something is not working {: .part }

Find your problem in the left column and try the fix on the right. Go slowly, one line at a time.

| What you see | What to try |
| --- | --- |
| The printer is not in the list | Check the power light is on and the cable is pushed in. Try a different USB port. Switch the printer off, wait 10 seconds, and on again. |
| CUPS asks for a password | Type your **computer's** username and password (not your MRK login). |
| The test page is blank or prints strange characters | That is normal for a "raw" test page. Try the **Test Print** inside MRK instead — that one is the real receipt. |
| MRK's Test Print does nothing | Make sure the **helper** is running, the address ends with **:9720**, both computers are on the same network, and the helper's port is allowed through the firewall. |
| The printer is on a network cable and still nothing | Give the printer a fixed IP, run **set-network-printer.bat** on the helper computer and enter that IP. Check `http://localhost:9720/health` — it should say `"transport":"network"`. |
| The receipt is very long, or blank | Set the paper size to the **80mm roll** in your printer settings and try again. |
| It prints on one computer but not another | The **helper** must run on the **printer's** computer, and every other computer must use that computer's address. |

<div class="callout note" markdown="1">
<div class="callout-title">Finding the helper</div>
On Windows, look in the **system tray** (bottom-right) or in **Task Manager** for **MRK** while it is running. If it is not there, run **install-start.bat** again as administrator.
</div>

---

# Words you may see (plain meanings)

| Word | What it means |
| --- | --- |
| **CUPS** | The printing manager on Mac and Linux. Your computer's "front desk" for printers. |
| **Driver** | The little piece of software that teaches the computer how to talk to one printer. |
| **Printer queue** | The list of jobs waiting to print, managed by the computer. |
| **ESC/POS** | The printing language receipt printers understand. |
| **Thermal printer** | A printer that prints on heat-sensitive paper, like a till slip — no ink. |
| **IP address** | The computer's number on the network, e.g. `192.168.1.50`. |
| **Port (9720)** | Like an apartment number on a building — it tells MRK exactly where the helper is listening. |
| **Helper / bridge** | The small program that passes receipts from MRK to your printer. |

---

# Still stuck?

No problem — help is one message away. When you contact **MRK support**, please include:

1. A **photo** of the printer and its lights.
2. The **exact step number** where it went wrong.
3. Any message shown on the screen (a photo is perfect).

With those three things, we can usually solve it on the first try.
