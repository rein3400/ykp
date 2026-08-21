$f = "C:\Users\stefa\AppData\Roaming\npm\node_modules\mmx-cli\dist\mmx.mjs"
$c = Get-Content $f -Raw
$pats = @('input_audio', 'image_url', 'content":[', 'type":"image', 'type":"text', 'multimodal', 'MiniMax-M3', 'M3')
foreach ($pat in $pats) {
  $i = $c.IndexOf($pat)
  Write-Output "=== $pat @ $i ==="
  if ($i -ge 0) { Write-Output $c.Substring($i, 500) }
}
