Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)
$green = [System.Drawing.Color]::FromArgb(34, 134, 58)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'HighQuality'
    $g.Clear($green)
    
    $margin = [int]($size * 0.25)
    $boxSize = $size - (2 * $margin)
    $g.FillRectangle([System.Drawing.Brushes]::White, $margin, $margin, $boxSize, $boxSize)
    
    $filename = "E:\Scripting\AmazonOrders\icon$size.png"
    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Write-Host "Icons created successfully"
