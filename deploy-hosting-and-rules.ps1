## Deploy Hosting and Firestore Rules
# This script deploys Firebase hosting and Firestore rules, excluding functions

Write-Host "Starting deployment of Firebase hosting and Firestore rules..." -ForegroundColor Cyan

# Step 1: First update the Firestore rules with the correct moderator UID
$moderatorUid = "yx9Kk8iB76ZmZfuFdoY7VzIkO5w2" # For incredibles23507@gmail.com
$rulesFile = "c:\Users\abhi2\OneDrive\Desktop\project 1\Take 1\firestore.rules"

Write-Host "Updating Firestore rules with the moderator UID..." -ForegroundColor Yellow
$rules = Get-Content $rulesFile -Raw
# Update the rules if they contain the placeholder
if ($rules -match "MOD_UID_2") {
    $rules = $rules -replace "MOD_UID_2", "$moderatorUid"
    $rules | Set-Content $rulesFile
    Write-Host "✓ Firestore rules updated" -ForegroundColor Green
} else {
    Write-Host "✓ Firestore rules already contain the correct UID" -ForegroundColor Green
}

# Step 2: Deploy Firestore rules
Write-Host "Deploying Firestore rules..." -ForegroundColor Yellow
firebase deploy --only firestore:rules
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firestore rules deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Error deploying Firestore rules" -ForegroundColor Red
    exit 1
}

# Step 3: Deploy hosting
Write-Host "Deploying Firebase hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firebase hosting deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Error deploying Firebase hosting" -ForegroundColor Red
    exit 1
}

Write-Host "Deployment completed successfully!" -ForegroundColor Cyan
Write-Host "Note: Functions were excluded from this deployment as requested."
