# Prepara a assinatura de loja sem mostrar senha nenhuma na tela.
# Procura a pasta "... - Google Play package (1)" em Downloads, copia o signing.keystore para android/upload.keystore
# e escreve android/keystore.properties (ignorado pelo git) com os dados do signing-key-info.txt dessa pasta.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\chave-loja.ps1   (na pasta mobile/)
$ErrorActionPreference = 'Stop'
$mobile = Split-Path -Parent $PSScriptRoot
$android = Join-Path $mobile 'android'
if (-not (Test-Path $android)) { throw 'Pasta android/ nao existe. Rode antes: npx expo prebuild --platform android' }

$downloads = Join-Path $env:USERPROFILE 'Downloads'
$pastas = Get-ChildItem -Path $downloads -Directory -Filter '* - Google Play package (1)' |
  Where-Object { (Test-Path (Join-Path $_.FullName 'signing.keystore')) -and (Test-Path (Join-Path $_.FullName 'signing-key-info.txt')) }
if (-not $pastas) { throw 'Nenhuma pasta "... - Google Play package (1)" com signing.keystore em Downloads' }
# Preferir a pasta antiga (nome nao comeca com "Anota"); as duas tem a mesma chave
$pasta = ($pastas | Sort-Object { if ($_.Name -like 'Anota*') { 1 } else { 0 } })[0]

$info = @{}
foreach ($linha in Get-Content (Join-Path $pasta.FullName 'signing-key-info.txt')) {
  $i = $linha.IndexOf(':')
  if ($i -gt 0) { $info[$linha.Substring(0, $i).Trim()] = $linha.Substring($i + 1).Trim() }
}
$storePassword = $info['Key store password']
$keyAlias = $info['Key alias']
$keyPassword = $info['Key password']
if (-not $storePassword -or -not $keyAlias -or -not $keyPassword) { throw 'signing-key-info.txt sem os campos esperados (Key store password / Key alias / Key password)' }

Copy-Item (Join-Path $pasta.FullName 'signing.keystore') (Join-Path $android 'upload.keystore') -Force

function Esc([string]$v) { return $v.Replace([string][char]92, [string][char]92 + [char]92) }
$texto = "storeFile=../upload.keystore`r`nstorePassword=$(Esc $storePassword)`r`nkeyAlias=$(Esc $keyAlias)`r`nkeyPassword=$(Esc $keyPassword)`r`n"
# Java le .properties em ISO-8859-1
[System.IO.File]::WriteAllText((Join-Path $android 'keystore.properties'), $texto, [System.Text.Encoding]::GetEncoding(28591))
Write-Output ("keystore.properties escrito a partir da pasta '" + $pasta.Name + "' (alias com " + $keyAlias.Length + " caracteres; senhas com " + $storePassword.Length + " e " + $keyPassword.Length + " caracteres)")
