# Add the actual moderator UID to the Firestore rules
$moderatorUid = "yx9Kk8iB76ZmZfuFdoY7VzIkO5w2" # This is for incredibles23507@gmail.com

# Update the rules to use this UID
$rulesFile = "c:\Users\abhi2\OneDrive\Desktop\project 1\Take 1\firestore.rules"
$rules = Get-Content $rulesFile -Raw
$rules = $rules -replace "MOD_UID_1', 'MOD_UID_2", "$moderatorUid"
$rules | Set-Content $rulesFile

# Deploy the rules
Write-Host "Deploying Firestore rules with the actual moderator UID..." -ForegroundColor Green
firebase deploy --only firestore:rules
