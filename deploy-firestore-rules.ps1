# Deploy Firestore Rules Script
Write-Host "Deploying Firestore Security Rules..." -ForegroundColor Green

# Verify Firebase CLI is installed
$firebaseExists = $null
try {
    $firebaseExists = Get-Command firebase -ErrorAction Stop
} catch {
    Write-Host "Firebase CLI is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Firebase CLI using: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "Then login using: firebase login" -ForegroundColor Yellow
    Exit 1
}

# Check if user is logged in to Firebase
Write-Host "Checking Firebase login status..." -ForegroundColor Blue
$loginStatus = firebase login:list
if (!$loginStatus -or $loginStatus -match "No users signed in") {
    Write-Host "You are not logged in to Firebase." -ForegroundColor Red
    Write-Host "Please login using: firebase login" -ForegroundColor Yellow
    Exit 1
}

# Deploy only Firestore rules
Write-Host "Deploying Firestore rules..." -ForegroundColor Blue
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "Firestore rules deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "Error deploying Firestore rules. Check the output above for errors." -ForegroundColor Red
    Exit 1
}
