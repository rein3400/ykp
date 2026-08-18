. "$PSScriptRoot\lib\wb.ps1"
. "$PSScriptRoot\lib\wb-dom.ps1"

$script:WbSession = 'ykp-qa-test'

nav "https://ykp-investor-v1.vercel.app/login" "login" $false "QA Test"
waitSettled 3000

$snap = snap "login-page"
Write-Host "Tree nodes with refs:"
function walk($node, $depth = 0) {
    $indent = "  " * $depth
    if ($node.ref) {
        Write-Host "$indent$($node.role): $($node.name) -> $($node.ref)"
    }
    foreach ($child in $node.children) { walk $child ($depth + 1) }
}
foreach ($node in $snap.tree) { walk $node }
