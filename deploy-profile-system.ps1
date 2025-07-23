# Deploy Firestore Rules Script
# This script deploys the updated Firestore security rules with user profile support

Write-Host "Deploying Firestore Rules with User Profile Support..." -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    firebase --version | Out-Null
    Write-Host "Firebase CLI found!" -ForegroundColor Green
} catch {
    Write-Host "Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Login check
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
$loginStatus = firebase login:list 2>&1
if ($loginStatus -like "*No authorized accounts*") {
    Write-Host "Please login to Firebase first:" -ForegroundColor Red
    Write-Host "firebase login" -ForegroundColor Yellow
    exit 1
}

# Deploy rules
Write-Host "Deploying Firestore security rules..." -ForegroundColor Yellow
try {
    firebase deploy --only firestore:rules
    Write-Host "Firestore rules deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New features enabled:" -ForegroundColor Cyan
    Write-Host "- User profile system" -ForegroundColor White
    Write-Host "- Public read access to user profiles" -ForegroundColor White
    Write-Host "- User document creation on login" -ForegroundColor White
    Write-Host ""
    Write-Host "Users can now:" -ForegroundColor Cyan
    Write-Host "- View other users' profiles by clicking their names" -ForegroundColor White
    Write-Host "- See public activity history (market listings, events, etc.)" -ForegroundColor White
    Write-Host "- Build trust through transparent user interactions" -ForegroundColor White
} catch {
    Write-Host "Failed to deploy Firestore rules!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deployment complete! The user profile system is now active." -ForegroundColor Green
