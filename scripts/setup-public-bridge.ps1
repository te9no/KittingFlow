param(
  [Parameter(Mandatory=$true)][string]$SiteOrigin,
  [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'KittingFlow'),
  [switch]$Trust
)
$ErrorActionPreference = 'Stop'
$site = [Uri]$SiteOrigin
if ($site.Scheme -ne 'https' -or $site.UserInfo -or $site.AbsolutePath -ne '/' -or $site.Query -or $site.Fragment) {
  throw 'Specify the HTTPS site origin without a path, query or fragment.'
}
$origin = $site.GetLeftPart([UriPartial]::Authority)
$directory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $directory -Force | Out-Null
# The exported private key is readable only by the current user and SYSTEM.
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule('SYSTEM', 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
Set-Acl -LiteralPath $directory -AclObject $acl
$pfxPath = Join-Path $directory 'loopback.pfx'
$cerPath = Join-Path $directory 'loopback.cer'
if ((Test-Path -LiteralPath $pfxPath) -or (Test-Path -LiteralPath $cerPath)) {
  if (!(Test-Path -LiteralPath $pfxPath) -or !(Test-Path -LiteralPath $cerPath)) { throw 'Incomplete existing certificate files.' }
  $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($cerPath)
  if ($certificate.NotAfter -lt (Get-Date).AddDays(7)) { throw 'Certificate expires soon. Renew the dedicated loopback certificate before setup.' }
} else {
  $temporary = New-SelfSignedCertificate -Type Custom -Subject 'CN=127.0.0.1' -FriendlyName 'KittingFlow local bridge' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddDays(365) -TextExtension @('2.5.29.17={text}IPAddress=127.0.0.1&DNS=localhost', '2.5.29.19={critical}{text}ca=false', '2.5.29.37={text}1.3.6.1.5.5.7.3.1')
  try {
    [IO.File]::WriteAllBytes($pfxPath, $temporary.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, ''))
    [IO.File]::WriteAllBytes($cerPath, $temporary.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
  } finally {
    Remove-Item -LiteralPath ('Cert:\CurrentUser\My\' + $temporary.Thumbprint)
  }
  $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($cerPath)
}
$config = @{ port = 17321; origins = @($origin, 'http://localhost:5173', 'http://127.0.0.1:5173'); pfxPath = $pfxPath }
[IO.File]::WriteAllText((Join-Path $directory 'bridge.json'), ($config | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
if ($Trust) {
  Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
}
Write-Output ('Origin: ' + $origin)
Write-Output ('Certificate SHA1 thumbprint: ' + $certificate.Thumbprint)
Write-Output ('Expires: ' + $certificate.NotAfter.ToString('yyyy-MM-dd'))
Write-Output ('Certificate: ' + $cerPath)
Write-Output ('Trusted by this command: ' + [bool]$Trust)
Write-Output 'Restart the KittingFlow MCP server, then request connection information in Codex.'
