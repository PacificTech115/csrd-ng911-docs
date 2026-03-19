<#
.SYNOPSIS
CSRD NG911 Web App Deployment Script (Pull-Based CI/CD)

.DESCRIPTION
This script is designed to run automatically via Windows Task Scheduler on the firewalled CSRD GIS Server.
It pulls the latest changes from the GitHub repository and cleanly mirrors them to the IIS web directory.

.NOTES
Requirements: Git for Windows must be installed on the server.
The Windows Scheduled Task should run under an account with permissions to read/write to the IIS directory.
#>

# ==============================================================================
# 1. Configuration (UPDATE THESE PATHS FOR YOUR SPECIFIC GIS SERVER ENVIRONMENT)
# ==============================================================================
$RepoDir = "C:\Users\Chilco\Documents\NG911Hub"   # The local clone of your GitHub repo on the server
$WebDir  = "C:\inetpub\wwwroot\ng911"             # The target IIS directory where the site is hosted
$LogFile = "C:\Users\Chilco\Documents\NG911Hub\deploy_log.txt" # Where to log deployment output

# ==============================================================================
# Script Execution
# ==============================================================================
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $LogFile -Value "[$Timestamp] Starting automated deployment check..."

try {
    # Step 1: Navigate to repository
    if (!(Test-Path -Path $RepoDir)) {
        throw "Repository directory not found at $RepoDir. Please clone the repo first."
    }
    Set-Location -Path $RepoDir
    
    # Step 2: Fetch latest history from GitHub
    Add-Content -Path $LogFile -Value "Fetching from origin..."
    $fetchOutput = git fetch origin main 2>&1
    Add-Content -Path $LogFile -Value $fetchOutput
    
    # Step 3: Check if we are behind the remote main branch
    $statusOutput = git status -uno 2>&1
    
    if ($statusOutput -match "Your branch is behind") {
        Add-Content -Path $LogFile -Value "Updates found! Pulling latest code..."
        
        # Pull the changes
        $pullOutput = git pull origin main 2>&1
        Add-Content -Path $LogFile -Value $pullOutput
        
        # Step 4: Mirror the Web App directory to IIS
        Add-Content -Path $LogFile -Value "Mirroring repo to IIS using Robocopy..."
        
        $SourceDir = Join-Path -Path $RepoDir -ChildPath "Web App"
        
        <#
          Robocopy arguments:
          /MIR : Mirror directory tree (equivalent to /E plus /PURGE)
          /MT:8 : Multi-threading
          /R:1 /W:1 : Retry once, wait 1 second
          /NDL /NFL : No directory/file logging
          /NP : No progress percentage
        #>
        # Execute natively to perfectly preserve paths with spaces
        & robocopy.exe "$SourceDir" "$WebDir" /MIR /MT:8 /R:1 /W:1 /NDL /NFL /NP
        
        $RoboCode = $LASTEXITCODE
        $TimestampEnd = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        
        if ($RoboCode -ge 8) {
            Add-Content -Path $LogFile -Value "[$TimestampEnd] ERROR: Robocopy failed with Exit Code $RoboCode.`n----------------------------------------"
        } else {
            Add-Content -Path $LogFile -Value "[$TimestampEnd] Deployment completed successfully! (Robocopy Code $RoboCode)`n----------------------------------------"
        }
    }
    else {
        Add-Content -Path $LogFile -Value "No updates detected. Branch is up to date.`n----------------------------------------"
    }

} catch {
    $ErrorMsg = $_.Exception.Message
    $TimestampErr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$TimestampErr] FATAL ERROR: $ErrorMsg`n----------------------------------------"
}
