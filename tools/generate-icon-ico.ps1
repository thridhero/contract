param(
  [string]$SourcePng = "build/icon.png",
  [string]$OutputIco = "build/icon.ico"
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path (Get-Location) $SourcePng
$outputPath = Join-Path (Get-Location) $OutputIco

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Source PNG not found: $sourcePath"
}

$outputDir = Split-Path -Parent $outputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$iconSizes = @(16, 24, 32, 48, 64, 128, 256)
$image = [System.Drawing.Image]::FromFile($sourcePath)

try {
  $entries = New-Object System.Collections.Generic.List[object]
  foreach ($size in $iconSizes) {
    $stream = $null
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($image, 0, 0, $size, $size)

      $stream = New-Object System.IO.MemoryStream
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $pngBytes = [byte[]]$stream.ToArray()

      $entries.Add([PSCustomObject]@{
        Size = $size
        Bytes = $pngBytes
      }) | Out-Null
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
      if ($stream) {
        $stream.Dispose()
      }
    }
  }

  $fileStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $writer = New-Object System.IO.BinaryWriter($fileStream)

  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$entries.Count)

    $offset = 6 + (16 * $entries.Count)
    foreach ($entry in $entries) {
      $dimensionByte = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
      $writer.Write([byte]$dimensionByte)
      $writer.Write([byte]$dimensionByte)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$entry.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $entry.Bytes.Length
    }

    $writer.Flush()
    foreach ($entry in $entries) {
      $fileStream.Write($entry.Bytes, 0, $entry.Bytes.Length)
    }
  }
  finally {
    $writer.Dispose()
    $fileStream.Dispose()
  }
}
finally {
  $image.Dispose()
}

$iconValidation = New-Object System.Drawing.Icon($outputPath)
try {
  if ($iconValidation.Size.Width -lt 16 -or $iconValidation.Size.Height -lt 16) {
    throw "Generated ICO validation failed: unexpected icon size $($iconValidation.Size.Width)x$($iconValidation.Size.Height)"
  }
}
finally {
  $iconValidation.Dispose()
}

Write-Host "Generated ICO: $outputPath"
