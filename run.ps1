param(
    [switch]$NoTunnel,
    [int]$Port = 8000,
    [string]$Host = "127.0.0.1"
)

$argsList = @()
if ($NoTunnel) { $argsList += "--no-tunnel" }
if ($Port -ne 8000) { $argsList += "--port", $Port }
if ($Host -ne "127.0.0.1") { $argsList += "--host", $Host }

python run.py @argsList
