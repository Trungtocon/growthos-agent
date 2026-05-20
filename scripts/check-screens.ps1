Write-Host "Checking Stitch UI files..."
npm run normalize:stitch
npm run check:stitch
Write-Host "Done. For visual parity, start npm run dev and run:"
Write-Host "STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:core"
