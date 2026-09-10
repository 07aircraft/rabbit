$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server running at http://localhost:8080/"

$root = $PSScriptRoot
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $rawPath = $request.Url.AbsolutePath
    if ($rawPath -eq "/" -or $rawPath -eq "") { $rawPath = "/index.html" }
    $relPath = $rawPath.TrimStart("/")
    $filePath = [System.IO.Path]::Combine($root, $relPath)

    Write-Host "Request: $rawPath -> $filePath"

    if ([System.IO.File]::Exists($filePath)) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = if ($mime[$ext]) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "  OK ($($bytes.Length) bytes)"
    } else {
      $response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
      $response.OutputStream.Write($msg, 0, $msg.Length)
      Write-Host "  404"
    }
    $response.Close()
  } catch {
    Write-Host "Error: $_"
  }
}
