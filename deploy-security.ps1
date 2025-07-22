# Firebase Security Deployment Script
# Run this script to deploy security rules to Firebase

Write-Host "Deploying Firebase Security Rules..."

# Check if Firebase CLI is installed
try {
    firebase --version | Out-Null
} catch {
    Write-Host "Firebase CLI is not installed."
    Write-Host "Please install it with: npm install -g firebase-tools"
    exit 1
}

# Check if user is logged in to Firebase
$loginStatus = firebase login:list 2>&1
if ($loginStatus -match "No active login credentials") {
    Write-Host "Not logged in to Firebase."
    Write-Host "Please run: firebase login"
    exit 1
}

Write-Host "Firebase CLI found and user is logged in"

# Deploy Firestore rules
Write-Host "Deploying Firestore Security Rules..."
try {
    firebase deploy --only firestore:rules
    Write-Host "Firestore security rules deployed successfully!"
} catch {
    Write-Host "Failed to deploy Firestore rules: $($_.Exception.Message)"
    exit 1
}

# Deploy Firestore indexes
Write-Host "Deploying Firestore Indexes..."
try {
    firebase deploy --only firestore:indexes
    Write-Host "Firestore indexes deployed successfully!"
} catch {
    Write-Host "Failed to deploy Firestore indexes: $($_.Exception.Message)"
    exit 1
}



