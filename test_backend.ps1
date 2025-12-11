$email = "test_verification_04@example.com"
$password = "password123"
$baseUrl = "http://localhost:3000/api/v1"

# Register
Write-Host "--- Registering ---"
try {
    $reg = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$password} | ConvertTo-Json)
    Write-Host "Registered: $($reg | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Register failed or user exists: $_"
}

# Login
Write-Host "--- Logging In ---"
try {
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$password} | ConvertTo-Json)
    $token = $login.access_token
    # Write-Host "Token: $token"
} catch {
    Write-Host "Login Failed: $_"
    exit 1
}

$headers = @{Authorization = "Bearer $token"}

# Create Account
Write-Host "--- Creating Account ---"
try {
    $account = Invoke-RestMethod -Uri "$baseUrl/accounts" -Method Post -ContentType "application/json" -Headers $headers -Body (@{name="Main Bank"; institution="Bank X"; type="CHECKING"; initialBalance=1000} | ConvertTo-Json)
    Write-Host "Account Created: $($account | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Create Account Failed: $_"
    exit 1
}

# Create Category
Write-Host "--- Creating Category ---"
try {
    $category = Invoke-RestMethod -Uri "$baseUrl/categories" -Method Post -ContentType "application/json" -Headers $headers -Body (@{name="Salary"; type="income"} | ConvertTo-Json)
    Write-Host "Category Created: $($category | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Create Category Failed: $_"
    exit 1
}

# Create Transaction
Write-Host "--- Creating Transaction ---"
try {
    $date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $transaction = Invoke-RestMethod -Uri "$baseUrl/transactions" -Method Post -ContentType "application/json" -Headers $headers -Body (@{type="income"; value=5000; date=$date; accountId=$account.id; categoryId=$category.id; description="Salary Init"} | ConvertTo-Json)
    Write-Host "Transaction Created: $($transaction | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Create Transaction Failed: $_"
}

# Create Fixed Transaction
Write-Host "--- Creating Fixed Transaction ---"
try {
    $fixed = Invoke-RestMethod -Uri "$baseUrl/fixed-transactions" -Method Post -ContentType "application/json" -Headers $headers -Body (@{type="expense"; value=50; referenceDay=5; marginDays=2; accountId=$account.id; categoryId=$category.id; description="Netflix"} | ConvertTo-Json)
    Write-Host "Fixed Transaction Created: $($fixed | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Create Fixed Transaction Failed: $_"
}

# Get Dashboard
Write-Host "--- Getting Dashboard ---"
try {
    $dashboard = Invoke-RestMethod -Uri "$baseUrl/dashboard" -Method Get -ContentType "application/json" -Headers $headers
    Write-Host "Dashboard: $($dashboard | ConvertTo-Json -Depth 5)"
} catch {
    Write-Host "Get Dashboard Failed: $_"
}
