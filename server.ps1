$port = 8080
$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Loopback, $port)
$server = New-Object System.Net.Sockets.TcpListener($endpoint)

try {
    $server.Start()
    Write-Host "HTTP server running at http://localhost:8080/"
} catch {
    Write-Host "Failed to start server on port 8080: $_"
    exit 1
}

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

while ($true) {
    try {
        $client = $server.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)

        $line = $reader.ReadLine()
        if ($line) {
            $tokens = $line -split ' '
            $reqPath = if ($tokens.Length -gt 1) { $tokens[1] } else { "/" }
            $reqPath = $reqPath.TrimStart('/')
            if ([string]::IsNullOrEmpty($reqPath) -or $reqPath -eq "/") {
                $reqPath = "index.html"
            }

            $localFile = Join-Path $root $reqPath

            if (Test-Path $localFile -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
                $mime = "text/plain"
                if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
                elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
                elseif ($ext -eq ".js") { $mime = "application/javascript; charset=utf-8" }
                elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }
                elseif ($ext -eq ".png") { $mime = "image/png" }
                elseif ($ext -eq ".zip") { $mime = "application/zip" }

                $bytes = [System.IO.File]::ReadAllBytes($localFile)
                $len = $bytes.Length
                $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $len`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $len = $notFound.Length
                $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $len`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($notFound, 0, $headerBytes.Length)
            }
        }
        $client.Close()
    } catch {
        # ignore request error
    }
}
