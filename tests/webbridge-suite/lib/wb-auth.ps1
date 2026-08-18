. "$PSScriptRoot\wb.ps1"
. "$PSScriptRoot\wb-dom.ps1"

function Login-HubForm($app) {
    $base = $app.base.TrimEnd('/')
    nav ($base + $app.loginPath) "login" $false "QA $($app.name)"
    waitSettled 1500
    fillRef "input[autocomplete='username']" $app.username
    fillRef "input[autocomplete='current-password']" $app.password
    clickRef "button[type='submit']"
    waitSettled 2000
}

function Login-Password($app) {
    $base = $app.base.TrimEnd('/')
    nav ($base + $app.loginPath) "login" $false "QA $($app.name)"
    waitSettled 1500

    $userSelector = "input[name='username'], input[type='text']"
    $passSelector = "input[name='password'], input[type='password']"
    fillRef $userSelector $app.username
    fillRef $passSelector $app.password

    $btn = Find-RefByText "Login|Masuk|Sign in" "button"
    if ($btn.Count -eq 0) {
        clickRef "button[type='submit']"
    } else {
        clickRef $btn[0]
    }
    waitSettled 2000
}

function Login-SSO($app) {
    $base = $app.base.TrimEnd('/')
    $redirect = [System.Web.HttpUtility]::UrlEncode($app.redirect)
    $url = "$base/api/auth/login?role=$($app.role)&redirect=$redirect"
    nav $url "sso" $false "QA $($app.name)"
    waitSettled 2000
}

function Test-LoggedIn {
    $code = @"
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) return true;
  } catch {}
  return !location.pathname.includes('/login');
})()
"@
    $res = wbeval $code
    return ($res.value -eq $true)
}

function Ensure-Session($app) {
    $needsLogin = $false
    try {
        $logged = Test-LoggedIn
        if (-not $logged) { $needsLogin = $true }
    } catch {
        $needsLogin = $true
    }

    if ($needsLogin) {
        switch ($app.auth) {
            'hub-form' { Login-HubForm $app }
            'password' { Login-Password $app }
            'sso' { Login-SSO $app }
            default { throw "Unknown auth mode: $($app.auth)" }
        }
    }
}

function Logout {
    $btn = Find-RefByText "Logout|Keluar" "button"
    if ($btn.Count -eq 0) {
        $btn = Find-RefByText "Logout|Keluar" "link"
    }
    if ($btn.Count -gt 0) {
        clickRef $btn[0]
        waitSettled 1500
    }
}
