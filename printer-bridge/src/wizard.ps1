# MRK Printer Setup — native Windows wizard (WinForms).
# Launched by mrk-printer-bridge.exe with a hidden console; the window below is
# the whole user interface. Talks to the local bridge over http://localhost:9720.
param(
  [string]$BaseUrl = 'http://localhost:9720'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$MRK  = [System.Drawing.Color]::FromArgb(0, 94, 184)
$INK  = [System.Drawing.Color]::FromArgb(32, 32, 32)
$GREY = [System.Drawing.Color]::FromArgb(105, 105, 105)
$OKC  = [System.Drawing.Color]::FromArgb(22, 130, 70)
$ERRC = [System.Drawing.Color]::FromArgb(190, 40, 40)

# ---------------------------------------------------------------- bridge api
function Get-Bridge([string]$path) {
  return Invoke-RestMethod -Method GET -Uri ($BaseUrl + $path)
}
function Save-Printer([string]$host_, [int]$port_) {
  $body = @{ printerHost = $host_; printerPort = $port_ } | ConvertTo-Json
  return Invoke-RestMethod -Method POST -Uri ($BaseUrl + '/config') -ContentType 'application/json' -Body $body
}

# Wait (briefly) for the bridge to answer /health.
$bridgeUp = $false
for ($i = 0; $i -lt 40; $i++) {
  try { Get-Bridge '/health' | Out-Null; $bridgeUp = $true; break } catch { Start-Sleep -Milliseconds 350 }
}

# ---------------------------------------------------------------- the form
$form = New-Object System.Windows.Forms.Form
$form.Text            = 'MRK Printer Setup'
$form.ClientSize      = New-Object System.Drawing.Size(620, 480)
$form.StartPosition   = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox     = $false
$form.MinimizeBox     = $false
$form.Font            = New-Object System.Drawing.Font('Segoe UI', 10)
$form.BackColor       = [System.Drawing.Color]::White

# header band
$header = New-Object System.Windows.Forms.Panel
$header.Dock = 'Top'; $header.Height = 68; $header.BackColor = $MRK
$hTitle = New-Object System.Windows.Forms.Label
$hTitle.Text = 'MRK Printer Setup'; $hTitle.ForeColor = 'White'
$hTitle.Font = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$hTitle.AutoSize = $true; $hTitle.Location = New-Object System.Drawing.Point(24, 18)
$header.Controls.Add($hTitle)

# footer bar with buttons
$footer = New-Object System.Windows.Forms.Panel
$footer.Dock = 'Bottom'; $footer.Height = 66; $footer.BackColor = [System.Drawing.Color]::FromArgb(244, 246, 249)
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.AutoSize = $false; $lblStatus.Location = New-Object System.Drawing.Point(24, 24)
$lblStatus.Size = New-Object System.Drawing.Size(340, 24); $lblStatus.ForeColor = $GREY
$btnBack   = New-Object System.Windows.Forms.Button
$btnNext   = New-Object System.Windows.Forms.Button
$btnCancel = New-Object System.Windows.Forms.Button
foreach ($b in @($btnBack, $btnNext, $btnCancel)) {
  $b.Height = 34; $b.Width = 100; $b.FlatStyle = 'System'; $b.UseVisualStyleBackColor = $true
}
$btnBack.Text = '< Back';   $btnBack.Location   = New-Object System.Drawing.Point(300, 16)
$btnNext.Text = 'Next >';   $btnNext.Location   = New-Object System.Drawing.Point(406, 16)
$btnCancel.Text = 'Cancel'; $btnCancel.Location = New-Object System.Drawing.Point(512, 16)
$btnNext.BackColor = $MRK; $btnNext.ForeColor = 'White'; $btnNext.FlatStyle = 'Flat'
$footer.Controls.AddRange(@($lblStatus, $btnBack, $btnNext, $btnCancel))

# content host (one step panel visible at a time)
$content = New-Object System.Windows.Forms.Panel
$content.Dock = 'Fill'; $content.Padding = New-Object System.Windows.Forms.Padding(24, 18, 24, 8)

$form.Controls.Add($content)
$form.Controls.Add($footer)
$form.Controls.Add($header)

# ---------------------------------------------------------------- helpers
function New-StepHead([string]$title, [string]$sub) {
  $p = New-Object System.Windows.Forms.Panel
  $p.Dock = 'Top'; $p.Height = 72; $p.BackColor = 'White'
  $t = New-Object System.Windows.Forms.Label
  $t.Text = $title; $t.ForeColor = $INK; $t.AutoSize = $true
  $t.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
  $t.Location = New-Object System.Drawing.Point(0, 0)
  $s = New-Object System.Windows.Forms.Label
  $s.Text = $sub; $s.ForeColor = $GREY; $s.AutoSize = $false
  $s.Location = New-Object System.Drawing.Point(0, 30); $s.Size = New-Object System.Drawing.Size(556, 38)
  $p.Controls.Add($t); $p.Controls.Add($s)
  return $p
}
function New-Body([string]$text) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text; $l.AutoSize = $false; $l.ForeColor = $INK
  $l.Location = New-Object System.Drawing.Point(0, 84); $l.Size = New-Object System.Drawing.Size(556, 40)
  return $l
}

# ---------------------------------------------------------------- step 1: welcome
$pWelcome = New-Object System.Windows.Forms.Panel
$pWelcome.Dock = 'Fill'; $pWelcome.BackColor = 'White'
$pWelcome.Controls.Add((New-Body "This will help you connect this computer to your MRK receipt printer.`r`nIt only takes a moment, and everything can be changed later."))
$pWelcome.Controls.Add((New-StepHead 'Welcome' 'Set up printing for the MRK point of sale.'))
$bodyW = $pWelcome.Controls[0]
$bodyW.Location = New-Object System.Drawing.Point(0, 92); $bodyW.Size = New-Object System.Drawing.Size(556, 90)

# ---------------------------------------------------------------- step 2: find printer
$pFind = New-Object System.Windows.Forms.Panel
$pFind.Dock = 'Fill'; $pFind.BackColor = 'White'
$headFind = New-StepHead 'Find your printer' 'Click Detect printers, then pick yours from the list.'
$btnDetect = New-Object System.Windows.Forms.Button
$btnDetect.Text = 'Detect printers'; $btnDetect.Location = New-Object System.Drawing.Point(0, 84)
$btnDetect.Size = New-Object System.Drawing.Size(150, 32)
$lblFound = New-Object System.Windows.Forms.Label
$lblFound.Text = ''; $lblFound.AutoSize = $false; $lblFound.ForeColor = $OKC
$lblFound.Location = New-Object System.Drawing.Point(162, 90); $lblFound.Size = New-Object System.Drawing.Size(394, 22)
$lstPrinters = New-Object System.Windows.Forms.ListBox
$lstPrinters.Location = New-Object System.Drawing.Point(0, 126); $lstPrinters.Size = New-Object System.Drawing.Size(556, 104)
$lstPrinters.Font = New-Object System.Drawing.Font('Consolas', 10)
$lblHost = New-Object System.Windows.Forms.Label
$lblHost.Text = 'Printer IP address:'; $lblHost.Location = New-Object System.Drawing.Point(0, 244); $lblHost.AutoSize = $true
$txtHost = New-Object System.Windows.Forms.TextBox
$txtHost.Location = New-Object System.Drawing.Point(0, 268); $txtHost.Size = New-Object System.Drawing.Size(300, 28)
$txtHost.Text = '192.168.1.100'
$lblPort = New-Object System.Windows.Forms.Label
$lblPort.Text = 'Port:'; $lblPort.Location = New-Object System.Drawing.Point(320, 244); $lblPort.AutoSize = $true
$txtPort = New-Object System.Windows.Forms.TextBox
$txtPort.Location = New-Object System.Drawing.Point(320, 268); $txtPort.Size = New-Object System.Drawing.Size(120, 28)
$txtPort.Text = '9100'
$pFind.Controls.AddRange(@($headFind, $btnDetect, $lblFound, $lstPrinters, $lblHost, $txtHost, $lblPort, $txtPort))

# ---------------------------------------------------------------- step 3: test / fix
$pTest = New-Object System.Windows.Forms.Panel
$pTest.Dock = 'Fill'; $pTest.BackColor = 'White'
$headTest = New-StepHead 'Test & finish' 'Send a test print to make sure everything works.'
$lblTarget = New-Object System.Windows.Forms.Label
$lblTarget.Text = ''; $lblTarget.AutoSize = $false; $lblTarget.ForeColor = $INK
$lblTarget.Location = New-Object System.Drawing.Point(0, 84); $lblTarget.Size = New-Object System.Drawing.Size(556, 24)
$btnTest = New-Object System.Windows.Forms.Button
$btnTest.Text = 'Test print'; $btnTest.Location = New-Object System.Drawing.Point(0, 116)
$btnTest.Size = New-Object System.Drawing.Size(140, 34)
$lblTestResult = New-Object System.Windows.Forms.Label
$lblTestResult.Text = ''; $lblTestResult.AutoSize = $false
$lblTestResult.Location = New-Object System.Drawing.Point(152, 122); $lblTestResult.Size = New-Object System.Drawing.Size(404, 40)
$fixBox = New-Object System.Windows.Forms.Panel
$fixBox.Location = New-Object System.Drawing.Point(0, 178); $fixBox.Size = New-Object System.Drawing.Size(556, 118)
$fixBox.BackColor = [System.Drawing.Color]::FromArgb(255, 248, 230)
$fixBox.BorderStyle = 'FixedSingle'; $fixBox.Visible = $false
$lblFix = New-Object System.Windows.Forms.Label
$lblFix.Text = "Printer plugged straight into this PC?`r`nThe printer needs a one-time connection fix. Windows will ask for permission once - click Yes."
$lblFix.Location = New-Object System.Drawing.Point(12, 12); $lblFix.Size = New-Object System.Drawing.Size(530, 44)
$lblFix.ForeColor = $INK
$btnFix = New-Object System.Windows.Forms.Button
$btnFix.Text = 'Fix direct-cable connection'; $btnFix.Location = New-Object System.Drawing.Point(12, 66)
$btnFix.Size = New-Object System.Drawing.Size(220, 36)
$fixBox.Controls.AddRange(@($lblFix, $btnFix))
$pTest.Controls.AddRange(@($headTest, $lblTarget, $btnTest, $lblTestResult, $fixBox))

# ---------------------------------------------------------------- step state
$script:steps = @($pWelcome, $pFind, $pTest)
$script:index = 0
foreach ($p in $script:steps) { $p.Visible = $false; $content.Controls.Add($p) }

function Show-Step([int]$i) {
  $script:index = $i
  for ($k = 0; $k -lt $script:steps.Count; $k++) { $script:steps[$k].Visible = ($k -eq $i) }
  $btnBack.Visible = ($i -gt 0)
  switch ($i) {
    0 { $lblStatus.Text = 'Step 1 of 3'; $btnNext.Text = 'Next >' }
    1 { $lblStatus.Text = 'Step 2 of 3'; $btnNext.Text = 'Next >' }
    2 {
      $lblStatus.Text = 'Step 3 of 3'; $btnNext.Text = 'Finish'
      $t = $txtHost.Text.Trim(); if (-not $t) { $t = '192.168.1.100' }
      $lblTarget.Text = "Printer: $t`:$($txtPort.Text.Trim())"
    }
  }
}

# ---------------------------------------------------------------- detect
$btnDetect.Add_Click({
  $lblFound.ForeColor = $GREY
  $lblFound.Text = 'Scanning the network, a few seconds...'
  $lstPrinters.Items.Clear()
  $btnDetect.Enabled = $false
  $job = Start-Job -ScriptBlock { param($u) Invoke-RestMethod -Uri ($u + '/discover') } -ArgumentList $BaseUrl
  while ($job.State -eq 'Running') {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 120
  }
  $res = $null
  try { $res = Receive-Job $job } catch { $res = $null }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  $btnDetect.Enabled = $true
  if ($res -and $res.ok -and $res.printers.Count -gt 0) {
    foreach ($p in $res.printers) {
      $ip = $p.ip; $port = 9100
      if ($p.ports -and $p.ports.Count -gt 0) { $port = $p.ports[0] }
      $mac = ''
      if ($p.mac) { $mac = '   ' + $p.mac }
      [void]$lstPrinters.Items.Add(($ip + ':' + $port + $mac))
    }
    $lblFound.ForeColor = $OKC
    $lblFound.Text = 'Found ' + $res.printers.Count + ' printer(s). Pick one below.'
  } else {
    $lblFound.ForeColor = $ERRC
    $lblFound.Text = 'None found. Type the IP below, or plug the cable into the router.'
  }
})

$lstPrinters.Add_SelectedIndexChanged({
  $sel = $lstPrinters.SelectedItem
  if ($sel) {
    $first = ($sel -split '\s+')[0]          # "ip:port"
    $parts = $first -split ':'
    $txtHost.Text = $parts[0]
    if ($parts.Count -gt 1) { $txtPort.Text = $parts[1] }
  }
})

# ---------------------------------------------------------------- test print
$btnTest.Add_Click({
  $lblTestResult.ForeColor = $GREY
  $lblTestResult.Text = 'Printing...'
  $target = $txtHost.Text.Trim() + ':' + $txtPort.Text.Trim()
  $init = [byte[]](27, 64)
  $body = [System.Text.Encoding]::ASCII.GetBytes("MRK PRINTER BRIDGE`nTest print OK`n$target`n$(Get-Date)`n`n`n")
  $cut  = [byte[]](29, 86, 66, 0)
  $all  = $init + $body + $cut
  try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('Content-Type', 'application/octet-stream')
    $raw = $wc.UploadData(($BaseUrl + '/print'), 'POST', $all)
    $j = [System.Text.Encoding]::UTF8.GetString($raw) | ConvertFrom-Json
    if ($j.ok) { $lblTestResult.ForeColor = $OKC; $lblTestResult.Text = 'Test print sent. If a receipt came out, you are done.'; $fixBox.Visible = $false }
    else { $lblTestResult.ForeColor = $ERRC; $lblTestResult.Text = 'Failed: ' + $j.error }
  } catch {
    $lblTestResult.ForeColor = $ERRC
    $lblTestResult.Text = 'Printer not reachable. If its cable goes straight into this PC, use the Fix button below.'
    $fixBox.Visible = $true
  }
})

# ---------------------------------------------------------------- direct-cable fix
$btnFix.Add_Click({
  $btnFix.Enabled = $false
  $lblFix.Text = 'Applying the fix. Accept the Windows permission prompt...'
  $hostOnly = $txtHost.Text.Trim()
  $payload = @{ printerHost = $hostOnly } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Method POST -Uri ($BaseUrl + '/setup/link') -ContentType 'application/json' -Body $payload
    if ($r.ok) {
      $lblFix.Text = 'Connection fixed: ' + $r.message
      $btnFix.Enabled = $true
    } else {
      $lblFix.Text = 'Fix failed: ' + $r.message
      $btnFix.Enabled = $true
    }
  } catch {
    $lblFix.Text = 'Fix did not complete. You may have clicked No on the Windows prompt. Try again.'
    $btnFix.Enabled = $true
  }
})

# ---------------------------------------------------------------- nav
$btnNext.Add_Click({
  if ($script:index -eq 0) { Show-Step 1; return }

  if ($script:index -eq 1) {
    $h = $txtHost.Text.Trim()
    if (-not $h) { [System.Windows.Forms.MessageBox]::Show('Please enter the printer IP address.', 'MRK Printer Setup'); return }
    $pt = 9100
    [void][int]::TryParse($txtPort.Text.Trim(), [ref]$pt)
    if ($pt -lt 1 -or $pt -gt 65535) { $pt = 9100 }
    $lblStatus.Text = 'Saving...'
    try { [void](Save-Printer $h $pt) }
    catch { [System.Windows.Forms.MessageBox]::Show('Could not save the settings. Is the bridge running?', 'MRK Printer Setup'); return }
    Show-Step 2
    return
  }

  # last step: finish
  [System.Windows.Forms.MessageBox]::Show('Setup complete. Printing is ready in MRK.', 'MRK Printer Setup')
  $form.Close()
})

$btnBack.Add_Click({ if ($script:index -gt 0) { Show-Step ($script:index - 1) } })
$btnCancel.Add_Click({ $form.Close() })

# ---------------------------------------------------------------- run
if (-not $bridgeUp) {
  [System.Windows.Forms.MessageBox]::Show("The MRK printer bridge did not start.`r`nPlease close this and double-click mrk-printer-bridge.exe again.", 'MRK Printer Setup')
}
Show-Step 0
[void]$form.ShowDialog()
