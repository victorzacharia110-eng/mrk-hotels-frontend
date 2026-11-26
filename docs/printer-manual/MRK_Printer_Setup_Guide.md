# The whole job in six steps

<div class="quickref" markdown="1">

Follow these six steps and the till printer is ready. Every step is explained slowly below.

1. **Download** `mrk-till-setup.zip` from MRK → **Printer Settings**.
2. **Extract** the zip into a folder you can find again; keep all four files together.
3. **Make Windows see the printer** and print a Windows test page; add it manually if Windows does not find it.
4. **Double-click `setup.bat`** and approve the Windows prompt. Do not run the other files by hand.
5. **Restart the browser**, open **Printer Settings**, select `POS-80C`, then press **Test Print**.
6. **Confirm no `Allow`/`Block` question appears.** If it does, run `setup.bat` again from a fresh download.

</div>

---

# Before you start

Check this list first. Keep the printer switched on and the paper roll loaded the whole time.

| What you need | A little more detail |
| --- | --- |
| The receipt printer | The thermal receipt printer, e.g. Romeson RM80ZJ, plugged into this till computer by USB. |
| Windows on the till computer | QZ Tray runs on the computer the printer cable is plugged into. Run the setup once on each till. |
| Chrome or Edge | A current browser with access to `https://mrk-hotels.com`. |
| The MRK login from reception | Use only your own login. Never ask another user for their password or OTP. |
| About 10 minutes | Most of that time is waiting for the setup window to finish. |

<div class="callout important" markdown="1">
<div class="callout-title">Important — this is a per-till setup</div>
Installing the zip on one computer does **not** configure the other tills. If you move to a different till, or Windows is reinstalled, download the zip again and run `setup.bat` on that computer too.
</div>

---

# Part 1 — Download the setup zip {: .part }

<div class="steps" markdown="1">

1. Sign in to **MRK Hotels** on the till computer.
2. Open the **cashier** area, then open **Printer Settings**.
3. Find **Setup guide & printer helper** and click **Till setup (`mrk-till-setup.zip`)**.
4. Save the file to a place you will remember, such as **Downloads** or the **Desktop**.
5. If an older copy of `mrk-till-setup.zip` is already on the computer, delete it first. A fresh copy is important — older copies may have the setup bug that caused the PowerShell error.

</div>

<div class="callout note" markdown="1">
<div class="callout-title">Always use the app link</div>
Download only from **MRK → Printer Settings** or `https://mrk-hotels.com/mrk-till-setup.zip`. Do not use a copy sent in chat, email, or another till unless support tells you to. The zip changes when we fix setup problems.
</div>

---

# Part 2 — Extract the zip {: .part }

<div class="steps" markdown="1">

1. Open **File Explorer**.
2. Go to the folder where you saved the zip.
3. Right-click `mrk-till-setup.zip`.
4. Choose **Extract All…**
5. Leave the suggested folder selected, or choose an easy folder such as `C:\Users\Public\Desktop\MRK Till Setup`.
6. Click **Extract**.
7. Open the new folder. You should see these four files:

</div>

| File | What it does |
| --- | --- |
| `setup.bat` | **The file you double-click.** It starts the setup safely and asks Windows for permission if needed. |
| `setup.ps1` | The detailed setup script. `setup.bat` runs this for you — do not right-click it directly. |
| `override.crt` | MRK's public root certificate. The script installs it into QZ Tray so silent printing works. You do not need to open it yourself. |
| `README.txt` | Short notes about the package. Read it if you like, but it does not replace this guide. |

<div class="callout tip" markdown="1">
<div class="callout-title">Keep the files together</div>
Do not move `setup.bat` away from the other files. It looks for `setup.ps1` and `override.crt` in the same folder. If you move one file alone, setup will fail.
</div>

---

# Part 3 — Make Windows see the printer {: .part }

<div class="os-head win" markdown="1">

<span class="badge win">Windows</span>

Before MRK can print, Windows must show the receipt printer in **Printers & scanners**. Do this once on the till computer, before you run `setup.bat`.

</div>

### A. The printer cable is plugged into this till

<div class="steps" markdown="1">

1. Make sure the printer is switched on, has paper, and its cable is plugged into this till computer.
2. Unplug the printer cable, wait five seconds, then plug it back into the same USB port.
3. Press the **Windows key** on the keyboard (or click **Start**), type `Printers & scanners`, then press **Enter**.
4. On the **Printers & scanners** page, click **Add a printer or scanner**.
5. Wait while Windows searches. Do not click other buttons while it is looking.
6. When the printer name appears, normally `POS-80C`, click it once, then click **Add device**.
7. If the printer does not appear, unplug and plug the cable again, wait 30 seconds, then click **Add a printer or scanner** again.
8. If it still does not appear, follow **"If Windows still does not show the printer"** just below.
9. Click the printer name, then click **Open print queue** on Windows 10, or **Printer properties** on Windows 11.
10. Choose **Print a test page**. A small test page must come out of the receipt printer. If nothing prints, stop here and check the power and cable.
11. Write down the exact printer name shown by Windows. You will use that same name in MRK Printer Settings.

</div>

### If Windows still does not show the printer — add it manually

<div class="steps" markdown="1">

1. Press the **Windows key**, type `Printers & scanners`, then press **Enter**.
2. Click **Add a printer or scanner**.
3. Wait until Windows finishes searching, then click **The printer that I want isn't listed** or **My printer is not shown**.
4. Choose **Add a printer using a USB port**, or **Use an existing port**, then click **Next**.
5. In the port list, look for **`USB001`**, `USB002`, or another `USB` port. It may be at the bottom, in the middle, or somewhere else depending on the computer — scroll the whole list slowly. Choose the port that appeared when the printer was plugged in. If you are not sure, unplug and plug the cable again and watch which port changes.
6. Click **Next**.
7. Choose **Romeson RM80ZJ** if it is listed. If not, click **Windows Update** and wait. If it is still missing, choose the model written on the printer box, or **Generic / Text Only**. If Windows asks for a driver you do not have, stop and contact MRK support with the printer model.
8. Type the printer name as **`POS-80C`**, then click **Next**.
9. Choose **Do not share this printer**, unless you are setting up section B below, then click **Next**.
10. Click **Print a test page**, then click **Finish**. A small test page must come out before you continue.

</div>

<div class="callout note" markdown="1">
<div class="callout-title">USB001 is a port, not the printer name</div>
`USB001` is the "door" Windows uses for the USB cable. It may be `USB002` or `USB003` on another computer. In MRK, select the printer name you typed, normally `POS-80C`, not `USB001`.
</div>

### B. The printer is shared from another Windows computer

Only do this section if the printer cable is plugged into a **different** computer. If the cable is plugged into this till, skip section B.

<div class="steps" markdown="1">

1. Go to the computer that the printer cable is plugged into.
2. Press the **Windows key**, type `Advanced sharing settings`, then press **Enter**.
3. Under **Private networks**, turn on **Network discovery** and **File and printer sharing**.
4. Click **Save changes**.
5. Press the **Windows key**, type `Printers & scanners`, then press **Enter**.
6. Click the receipt printer, then click **Printer properties**.
7. Open the **Sharing** tab, tick **Share this printer**, type the name `POS-80C`, then click **OK**.
8. Go back to the till computer. Hold the **Windows key** and press **R**, type the other computer's name like `\\RECEPTION-PC`, then press **Enter**.
9. When the shared printer appears, right-click it and choose **Connect**. Allow Windows to install any printer driver it asks for.
10. Print a Windows test page from the till before continuing. If no page comes out, stop and repeat section B on the computer that owns the printer.

</div>

<div class="callout important" markdown="1">
<div class="callout-title">Do not continue until the Windows test page prints</div>
A Windows test page proves the till computer can see the printer. MRK and QZ Tray can only use a printer that Windows already knows about.
</div>

---

# Part 4 — Run the setup (the important part) {: .part }

<div class="os-head win" markdown="1">

<span class="badge win">Windows</span>

This is the step that was missing from the old guide. **Downloading the zip alone does not configure the printer** — you must run `setup.bat` once.

</div>

<div class="steps" markdown="1">

1. In the extracted folder, **double-click `setup.bat`**.
2. If Windows shows **User Account Control** ("Do you want to allow this app to make changes?"), click **Yes**. This is expected once; the script needs permission to install QZ Tray and trust the MRK certificate.
3. A PowerShell window opens. Leave it alone and let it finish. It may take a minute.
4. Watch for this line near the end: `Verifying silent printing is configured... OK`. That means QZ Tray is ready.
5. When the window says **setup complete**, close it.
6. If the window shows `NOT CONFIGURED`, a red error, or the old `Cannot overwrite variable home` message, close it, delete the folder, download a **fresh** zip from Printer Settings, and start again at Part 2.

</div>

<div class="callout important" markdown="1">
<div class="callout-title">Do not click Allow or Block inside QZ Tray</div>
The setup installs MRK's own certificate so the browser already trusts this till. You should **not** see a QZ Tray `Allow`/`Block` dialog when you test print. If you do, run `setup.bat` again from a fresh zip. Do not click **Block**.
</div>

<div class="callout note" markdown="1">
<div class="callout-title">What the script actually does</div>
It checks whether QZ Tray is installed and installs it if missing; copies MRK's public certificate into QZ Tray's trusted store; clears the stale QZ trust prompt; restarts QZ Tray so the trust takes effect; and leaves the signing private key on the MRK server. The zip contains **no private key** and no MRK password.
</div>

---

# Part 5 — Restart the browser and choose the printer {: .part }

<div class="steps" markdown="1">

1. Close every Chrome or Edge window on the till.
2. Open the browser again and sign in to **MRK Hotels**.
3. Open **Cashier → Printer Settings**.
4. Check the QZ status shows **Connected**. If it shows **Not connected**, wait a few seconds and press **Refresh**.
5. In the printer list, choose the same name Windows showed in Part 3, normally **`POS-80C`**. If Windows showed a different name, choose that exact name instead.
6. Make sure **Method** is **QZ Tray / USB**. Do not choose **Server** for a USB receipt printer on the till.
7. Press **Test Print**. A small MRK receipt should come out.
8. If a QZ `Allow`/`Block` box appears, click nothing. Close it, run `setup.bat` again from a fresh zip, then repeat from step 1.

</div>

<div class="callout tip" markdown="1">
<div class="callout-title">If the login says "invalid credentials"</div>
This usually means the browser cached the old local API address, not that the password is wrong. Press `Ctrl+Shift+R`, or open a private window and sign in again. If it still fails, ask reception to reset your MRK password — do not borrow someone else's password or OTP.
</div>

---

# Part 6 — Make it silent (no dialog on every sale) {: .part }

Silent printing means the receipt comes out by itself when a bill is settled. It is controlled by the certificate installed in Part 4, not by a browser checkbox.

<div class="steps" markdown="1">

1. Open **Printer Settings** again.
2. Find **Print on settle** and leave it **on** if receipts must print automatically.
3. Press **Test print** once more.
4. The receipt should appear with **no QZ Tray question at all**.
5. Do not disable QZ Tray in Windows startup. It must be running whenever the till is in use.

</div>

<div class="callout important" markdown="1">
<div class="callout-title">Silent printing is a security setting — do not work around it</div>
Do not disable Windows SmartScreen, turn off certificate checks, share the setup zip with other hotels, or copy a certificate from another computer. The only safe fix for a trust prompt is to rerun the official `setup.bat` from a fresh MRK download.
</div>

---

# Part 7 — If something is not working {: .part }

Find what you see in the left column and try the fix on the right. Go slowly, one line at a time.

| What you see | What to try |
| --- | --- |
| `Cannot overwrite variable home...` in PowerShell | You have an older zip. Delete it and the extracted folder, download a fresh `mrk-till-setup.zip` from Printer Settings, then run `setup.bat` again. |
| A QZ Tray `Allow`/`Block` dialog appears | Run `setup.bat` again from a fresh zip. Do not click **Block**. After it finishes, fully close and reopen the browser. |
| `Verifying silent printing is configured... NOT CONFIGURED` | The script did not finish or Windows denied permission. Right-click `setup.bat`, choose **Run as administrator**, and let it complete. |
| The printer is not in the list | Go back to **Part 3A**. Check the power and cable, add the printer in Windows **Printers & scanners**, and print a Windows test page. Then return to MRK and press **Refresh**. |
| Windows cannot find the printer | Unplug and plug the cable, wait 30 seconds, then run **Add a printer or scanner** again. If it still does not appear, add it manually using the `USB001`-style port in **Part 3**. |
| Only `USB001` or `USB002` appears | That is the USB port, not the printer. Choose that port, name the printer `POS-80C`, and select `POS-80C` in MRK. |
| The Windows test page does not print | Check power, paper, and cable. For a shared printer, confirm **Network discovery** and **File and printer sharing** are on. Do not continue until a Windows test page prints. |
| QZ status says **Not connected** | Make sure QZ Tray is running in the Windows system tray. Restart it once, then reload Printer Settings. |
| Test print says **No printer selected** | Choose the exact Windows printer name from Part 3, normally `POS-80C`, press **Save**, then press **Test Print** again. |
| Login says **invalid credentials** | Press `Ctrl+Shift+R` or use a private window. Do not reuse another staff member's password or OTP. |
| Receipt prints on another till but not this one | Run `setup.bat` on this till. Every till computer needs its own one-time setup. |
| The browser still uses `localhost` | Ask reception to use `https://mrk-hotels.com`, hard-refresh, and sign in again. The app must use `https://api.mrk-hotels.com/api`. |

<div class="callout note" markdown="1">
<div class="callout-title">Finding QZ Tray</div>
Look in the Windows **system tray** (bottom-right, sometimes behind the `^` arrow). The QZ Tray icon should be present while the till is in use. If it is missing, open the Start menu and search for **QZ Tray**, or rerun `setup.bat`.
</div>

---

# Security rules for staff

<div class="callout important" markdown="1">
<div class="callout-title">Share instructions, never credentials</div>
Send this PDF or the setup steps to staff. **Never** send your MRK password, OTP code, or another staff member's login. If someone cannot sign in, reception should reset their own account.
</div>

| Rule | Why |
| --- | --- |
| Download the zip only from MRK Printer Settings or `https://mrk-hotels.com/mrk-till-setup.zip` | Older or copied zips may contain the PowerShell bug. |
| Run `setup.bat` only on the till computer that owns the receipt printer | QZ Tray trusts the browser on that machine only. |
| Do not open, rename, or email `override.crt` | It is a public certificate installed by the script; moving it can break silent printing. |
| Do not send passwords or OTPs in chat | OTPs are single-use and belong to one staff member. |
| Do not click **Block** in a QZ dialog | Blocking stops silent receipts; rerun the official setup instead. |
| Do not reuse another hotel's zip | Each hotel has its own signing key on its own server. |

---

# Words you may see (plain meanings)

| Word | What it means |
| --- | --- |
| **QZ Tray** | The small Windows program that lets the browser print to the local USB printer without a dialogue on every sale. |
| **`setup.bat`** | The one-click launcher that asks Windows for permission and runs the full setup. |
| **`setup.ps1`** | The setup script. It is run by `setup.bat`; you do not need to open it. |
| **`override.crt`** | MRK's public root certificate that tells QZ Tray the print request really came from MRK. |
| **Silent printing** | Receipts print automatically when a bill is settled; no `Allow`/`Block` question appears. |
| **POS-80C** | The usual Windows printer name for the till receipt printer. If Windows shows another name, use that exact name in MRK. |
| **Printers & scanners** | The Windows page where printers are added and tested. |
| **Network discovery** | A Windows setting that lets this computer find shared printers on the same network. |
| **File and printer sharing** | A Windows setting that lets other computers use a printer connected to this computer. |
| **`USB001`** | The Windows USB port name used when adding a printer manually. It may be `USB002` or `USB003` on a different computer; it is not the printer name. |
| **OTP** | The one-time code sent to your phone. It is part of your login — never share it. |
| **ESC/POS** | The language thermal receipt printers understand. |

---

# Still stuck?

No problem — help is one message away. When you contact **MRK support**, include:

1. A **photo** of the PowerShell window (including the exact error line).
2. A **photo** of the QZ Tray icon/status in Printer Settings.
3. The **part and step number** from this guide where it went wrong.
4. Whether a Windows test page printed from **Printers & scanners**.
5. Whether you downloaded a fresh zip and ran `setup.bat` as administrator.

With those five things, we can usually solve it on the first try.

---

# Final comparison — completed installation {: .part }

Use this photo as the reference for a correctly completed till setup. Compare your own **Printer Settings** screen and the printed receipt with it before you close this guide.

<div class="reference-image" markdown="1">

![Completed MRK till printer setup reference](printer-manual/completed-installation.jpeg)

<p class="reference-caption">Reference photo from a completed MRK till printer installation.</p>

</div>

| Check | What complete looks like |
| --- | --- |
| Browser | Open at `https://mrk-hotels.com`, signed in with the till user's own login. |
| Windows printer | The printer appears in **Printers & scanners** and a Windows test page printed successfully. |
| QZ status | **Connected** in **Cashier → Printer Settings**. |
| Printer | The USB receipt printer is selected using the exact Windows printer name, normally `POS-80C`, not `USB001`. |
| Method | **QZ Tray / USB** — not **Server** for a local USB printer. |
| Test print | A small MRK receipt comes out of the till printer. |
| Trust prompt | No QZ Tray `Allow`/`Block` dialog appears. |
| Staff security | Nobody shared a password, OTP, or another till's setup file. |

<div class="callout tip" markdown="1">
<div class="callout-title">Ready to use</div>
If all eight checks match, the till is ready for normal service. Leave QZ Tray running and keep the printer switched on with paper loaded.
</div>
