$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# The main documentation folder is up one level from 'docs'
$rootDir = (Get-Item $scriptDir).Parent.FullName

$outputFile = Join-Path $scriptDir "search-data.js"
$searchData = @()

# We want to index the main Documentation.html and everything inside docs/
$filesToIndex = @(Get-Item (Join-Path $rootDir "Documentation.html"))
$filesToIndex += Get-ChildItem -Path $scriptDir -Filter "*.html" | Where-Object { 
    $_.Name -ne "version-edits.html" -and $_.Name -ne "Documentation.html" 
}

foreach ($file in $filesToIndex) {
    # Skip if it's not a real file
    if (-not (Test-Path $file.FullName)) { continue }

    $html = Get-Content $file.FullName -Raw
    
    # Try to extract just the title
    $title = $file.Name
    if ($html -match '<title>(.*?)</title>') {
        $title = $matches[1] -replace ' — CSRD NG911 Documentation',''
    }

    # Extract the main content area to avoid indexing nav/footer text
    $content = ""
    if ($html -match '(?s)<div class="content-wrap"[^>]*>(.*?)<footer class="site-footer">') {
        $content = $matches[1]
    } elseif ($html -match '(?s)<body>(.*?)</body>') {
        $content = $matches[1]
    } else {
        $content = $html
    }

    # Strip HTML tags
    $cleanText = $content -replace '<[^>]+>', ' '
    # Strip script contents 
    $cleanText = $cleanText -replace '(?s)<script.*?>.*?</script>', ' '
    # Strip multiple spaces and line breaks
    $cleanText = $cleanText -replace '\s+', ' '
    $cleanText = $cleanText.Trim()

    # Escape quotes for JSON
    $cleanText = $cleanText -replace '\"', '\"'
    $title = $title -replace '\"', '\"'

    $searchData += @{
        path = if ($file.DirectoryName -eq $rootDir) { $file.Name } else { "docs/" + $file.Name }
        pageId = $file.Name
        title = $title
        content = $cleanText
    }
}

$jsonObj = $searchData | ConvertTo-Json -Depth 5 -Compress
$jsContent = "window.CSRD_SEARCH_INDEX = $jsonObj;"

Set-Content -Path $outputFile -Value $jsContent -Encoding UTF8
Write-Host "Search index built successfully at $outputFile with $($searchData.Count) files."
