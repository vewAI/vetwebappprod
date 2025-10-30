param(
  [string]$BaseUrl = "http://localhost:3000"
)

function Try-Rest {
  param($Method, $Path, $Body = $null)
  # If BaseUrl already contains a query string, insert the path before the '?' so
  # query params (like the Vercel bypass) apply to the API path instead of the root.
  if ($BaseUrl -match '^(.*?)(\?(.*))$') {
    $basePart = $matches[1]
    $queryPart = '?' + $matches[3]
    $uri = $basePart.TrimEnd('/') + $Path + $queryPart
  } else {
    $uri = $BaseUrl.TrimEnd('/') + $Path
  }

  # Prepare headers; include protection bypass header when supplied in env
  $headers = @{}
  if ($env:BYPASS -and $env:BYPASS.Trim() -ne '') {
    $headers['x-vercel-protection-bypass'] = $env:BYPASS
    # Ask the server to set a cookie if it supports that flow
    $headers['x-vercel-set-bypass-cookie'] = 'true'
  }
  Write-Host "`n>> $Method $uri"
  try {
    if ($Body -ne $null) {
      $json = $Body | ConvertTo-Json -Depth 10
      if ($headers.Count -gt 0) {
        $res = Invoke-RestMethod -Uri $uri -Method $Method -Body $json -ContentType 'application/json' -Headers $headers -ErrorAction Stop
      } else {
        $res = Invoke-RestMethod -Uri $uri -Method $Method -Body $json -ContentType 'application/json' -ErrorAction Stop
      }
    } else {
      if ($headers.Count -gt 0) {
        $res = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ErrorAction Stop
      } else {
        $res = Invoke-RestMethod -Uri $uri -Method $Method -ErrorAction Stop
      }
    }
    Write-Host "Status: 200 OK"
    try { Write-Host ($res | ConvertTo-Json -Depth 10) } catch { Write-Host $res }
    return @{ ok = $true; data = $res }
  } catch {
    $err = $_
    $respBody = $null; $status = $null
    if ($err.Exception -and $err.Exception.Response) {
      try {
        $webResp = [System.Net.HttpWebResponse]$err.Exception.Response
        $status = $webResp.StatusCode.value__
        $sr = New-Object System.IO.StreamReader($webResp.GetResponseStream())
        $respBody = $sr.ReadToEnd()
      } catch {
        $respBody = $err.ToString()
      }
    } else { $respBody = $err.ToString() }
  $statusDisplay = if ($status -ne $null) { $status } else { "N/A" }
  Write-Host "Request failed. Status:" $statusDisplay
    Write-Host "Body/Message:"
    Write-Host $respBody
    return @{ ok = $false; status = $status; body = $respBody; error = $err }
  }
}

Write-Host "Running smoke tests against: $BaseUrl"

# 1) GET /api/cases
$g = Try-Rest -Method 'GET' -Path '/api/cases'
if (-not $g.ok) {
  Write-Host "`nAborting further tests because GET /api/cases failed or returned non-JSON (could be auth-protected)."
  exit 1
}

# 2) POST /api/cases
$now = Get-Date -Format 'yyyyMMddHHmmss'
$payload = @{
  title = "smoke-test-case-$now"
  species = "horse"
  condition = "smoke-test-run"
}
$p = Try-Rest -Method 'POST' -Path '/api/cases' -Body $payload
if (-not $p.ok) { Write-Host "`nPOST /api/cases failed; aborting remaining steps."; exit 1 }

# Extract created id
$createdId = $null
if ($p.data -ne $null) {
  if ($p.data.data) {
    $maybe = $p.data.data
    if ($maybe -is [System.Array]) { $createdId = $maybe[0].id } else { $createdId = $maybe.id }
  } elseif ($p.data.id) { $createdId = $p.data.id }
  elseif ($p.data -is [System.Array] -and $p.data.Count -gt 0) { $createdId = $p.data[0].id }
}
Write-Host "`nCreated case id: $createdId"

# 3) POST /api/chat
$chatBody = @{
  messages = @(@{ role = 'user'; content = 'Hello — smoke test.' })
  stageIndex = 0
  caseId = $createdId
}
$c = Try-Rest -Method 'POST' -Path '/api/chat' -Body $chatBody
if (-not $c.ok) { Write-Host "`nPOST /api/chat failed (see above)."; }

# 4) PUT /api/cases (update owner_background)
if ($createdId) {
  $updateBody = @{ id = $createdId; owner_background = "Smoke owner background updated at $now" }
  $u = Try-Rest -Method 'PUT' -Path '/api/cases' -Body $updateBody
  if (-not $u.ok) { Write-Host "`nPUT /api/cases failed." }
} else { Write-Host "`nSkipping PUT /api/cases (no created id)." }

# 5) PUT /api/cases/image
if ($createdId) {
  $imgBody = @{ id = $createdId; image_url = 'https://placekitten.com/800/600' }
  $i = Try-Rest -Method 'PUT' -Path '/api/cases/image' -Body $imgBody
  if (-not $i.ok) { Write-Host "`nPUT /api/cases/image failed." }
} else { Write-Host "`nSkipping PUT /api/cases/image (no created id)." }

Write-Host "`nSmoke test run complete."