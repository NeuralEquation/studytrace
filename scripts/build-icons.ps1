# Rasterize the existing geometric StudyTrace mark for mobile PWA launchers.
Add-Type -AssemblyName System.Drawing
$destination = Join-Path $PSScriptRoot '../public'
foreach ($spec in @(@('icon-192.png',192), @('icon-512.png',512), @('icon-maskable-512.png',512), @('apple-touch-icon.png',180))) {
  $size = [int]$spec[1]
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#234f43'))
  $graphics.ScaleTransform($size / 128.0, $size / 128.0)
  # Central safe-zone placement also fits Android adaptive masks.
  $graphics.TranslateTransform(16,16)
  $graphics.ScaleTransform(0.75,0.75)
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#d7e8b2'),9)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(30,91),[System.Drawing.PointF]::new(30,38),[System.Drawing.PointF]::new(54,38),[System.Drawing.PointF]::new(54,78),[System.Drawing.PointF]::new(74,78),[System.Drawing.PointF]::new(74,29),[System.Drawing.PointF]::new(98,29),[System.Drawing.PointF]::new(98,91))
  $graphics.DrawLines($pen,$points)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#e1b969'))
  $graphics.FillEllipse($brush,91,22,14,14)
  $bitmap.Save((Join-Path $destination $spec[0]),[System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
