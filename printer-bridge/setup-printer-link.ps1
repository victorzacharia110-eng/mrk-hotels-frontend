<#
  MRK Printer Bridge - direct-cable printer link setup (Windows)

  Use this when the thermal printer is plugged STRAIGHT INTO this PC's
  Ethernet port (a "direct cable"), NOT into the router.

  Why it is needed: the printer ships with a fixed IP such as 192.168.1.100,
  which sits on the same subnet the PC's Wi-Fi is already using (192.168.1.x).
  Giving the Ethernet port a normal /24 address would make Windows try to send
  ALL 192.168.1.x traffic down the printer cable and break the internet.

  This script gives the Ethernet port a /32 (192.168.1.10) so it never claims
  the whole subnet, then adds a host route so ONLY the printer's IP uses it.
  Wi-Fi keeps 192.168.1.x + internet. Exactly the same trick that already works
  on the Linux test PC.

  Run this in an ADMINISTRATOR PowerShell, after plugging the printer cable in.
#>
param(
    [string]$PrinterIP = "192.168.1.100",
    [string]$LocalIP   = "192.168.1.10"
)

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERROR] Run this as Administrator (right-click PowerShell -> Run as administrator)." -ForegroundColor Red
    exit 1
}

# Find the wired (non-Wi-Fi) adapter that is actually Up (printer cable plugged in).
$nic = Get-NetAdapter | Where-Object {
    $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Wi-?Fi|Wireless|802\.11'
} | Select-Object -First 1

if (-not $nic) {
    Write-Host "[ERROR] No wired Ethernet adapter is Up." -ForegroundColor Red
    Write-Host "        Plug the printer cable into this PC, wait ~10 seconds, then run this again."
    exit 1
}

Write-Host "Printer IP : $PrinterIP"
Write-Host "Local IP   : $LocalIP (/32)"
Write-Host "Adapter    : $($nic.Name)  ($($nic.InterfaceDescription))"
Write-Host ""

# Clear any existing IPv4 config on that port so we start clean.
Get-NetIPAddress -InterfaceIndex $nic.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-NetIPAddress -IPAddress $_.IPAddress -InterfaceIndex $nic.ifIndex -Confirm:$false -ErrorAction SilentlyContinue }
Get-NetRoute -InterfaceIndex $nic.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-NetRoute -DestinationPrefix $_.DestinationPrefix -InterfaceIndex $nic.ifIndex -Confirm:$false -ErrorAction SilentlyContinue }

# Give the port a /32 so it does NOT create a 192.168.1.0/24 route (no clash with Wi-Fi).
New-NetIPAddress -InterfaceIndex $nic.ifIndex -IPAddress $LocalIP -PrefixLength 32 -ErrorAction Stop | Out-Null

# Route ONLY the printer's IP through this port.
New-NetRoute -InterfaceIndex $nic.ifIndex -DestinationPrefix "$PrinterIP/32" -NextHop $LocalIP -ErrorAction Stop | Out-Null

Write-Host "Added route to $PrinterIP via $($nic.Name):" -ForegroundColor Green
Get-NetRoute -DestinationPrefix "$PrinterIP/32" | Format-Table DestinationPrefix, NextHop, InterfaceAlias, RouteMetric -AutoSize

Write-Host "Next: test it with ->  ping $PrinterIP"
Write-Host "Then run set-network-printer.bat and enter $PrinterIP"
