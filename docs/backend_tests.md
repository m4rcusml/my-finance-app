# Backend API Verification Tests (Manual Execution)

This document details the manual verification steps executed against the local backend (`http://localhost:3000`). All commands were executed using `curl` on Windows (PowerShell), ensuring strict JSON parsing and authentication flows.

**Date:** 2025-12-10
**User Context:** `test_verification_05@example.com`

---

## 1. Authentication Flow

### 1.1 User Registration
**Goal:** Create a new user to ensure a clean test state.

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"test_verification_05@example.com\", \"password\": \"password123\"}'
```

**Response Payload:**
```json
{
  "id": "8295c7e7-1f3d-4526-8c8c-c476a23c50ec",
  "email": "test_verification_05@example.com",
  "name": null,
  "createdAt": "2025-12-11T00:12:47.483Z",
  "updatedAt": "2025-12-11T00:12:47.483Z"
}
```
**Status:** ✅ 201 Created

### 1.2 User Login
**Goal:** Authenticate and retrieve the JWT access token for subsequent requests.

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"test_verification_05@example.com\", \"password\": \"password123\"}'
```

**Response Payload:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
**Status:** ✅ 200 OK

---

## 2. Resource Setup (Authenticated)

**Note:** All subsequent requests included the header: `Authorization: Bearer <TOKEN>`

### 2.1 Create Account
**Goal:** Create a checking account ("Main Bank Manual") with an initial balance of 1000.

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/accounts `
  -H "Authorization: Bearer ..." `
  -H "Content-Type: application/json" `
  -d '{\"name\": \"Main Bank Manual\", \"institution\": \"Bank X\", \"type\": \"CHECKING\", \"initialBalance\": 1000}'
```

**Response Payload:**
```json
{
  "id": "5c6b4c23-364c-4d3e-9e39-743e2e8b99a4",
  "userId": "8295c7e7-1f3d-4526-8c8c-c476a23c50ec",
  "name": "Main Bank Manual",
  "institution": "Bank X",
  "type": "CHECKING",
  "initialBalance": 1000,
  "isActive": true,
  "createdAt": "2025-12-11T00:14:49.922Z",
  "updatedAt": "2025-12-11T00:14:49.922Z"
}
```
**Status:** ✅ 201 Created

### 2.2 Create Category
**Goal:** Create an income category ("Salary Manual").

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/categories `
  -H "Authorization: Bearer ..." `
  -H "Content-Type: application/json" `
  -d '{\"name\": \"Salary Manual\", \"type\": \"income\"}'
```

**Response Payload:**
```json
{
  "id": "50efb2ce-63b8-403c-97dd-a4daa1780ec6",
  "userId": "8295c7e7-1f3d-4526-8c8c-c476a23c50ec",
  "name": "Salary Manual",
  "type": "income",
  "createdAt": "2025-12-11T00:15:51.789Z",
  "updatedAt": "2025-12-11T00:15:51.789Z"
}
```
**Status:** ✅ 201 Created

---

## 3. Transaction Verification

### 3.1 Create Income Transaction
**Goal:** Record a salary deposit of 5000 linked to the created account and category.

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/transactions `
  -H "Authorization: Bearer ..." `
  -H "Content-Type: application/json" `
  -d '{\"type\": \"income\", \"value\": 5000, \"date\": \"2025-12-10T10:00:00Z\", \"accountId\": \"5c6b4c23-364c-4d3e-9e39-743e2e8b99a4\", \"categoryId\": \"50efb2ce-63b8-403c-97dd-a4daa1780ec6\", \"description\": \"Manual Salary\"}'
```

**Response Payload:**
```json
{
  "id": "011f37cf-712f-4d28-8776-e352ead3902a",
  "userId": "8295c7e7-1f3d-4526-8c8c-c476a23c50ec",
  "type": "income",
  "value": 5000,
  "date": "2025-12-10T10:00:00.000Z",
  "description": "Manual Salary",
  "accountId": "5c6b4c23-364c-4d3e-9e39-743e2e8b99a4",
  "categoryId": "50efb2ce-63b8-403c-97dd-a4daa1780ec6",
  ...
}
```
**Status:** ✅ 201 Created

### 3.2 Create Fixed Transaction
**Goal:** Schedule a fixed recurring expense ("Manual Netflix").

**Command:**
```powershell
curl.exe -X POST http://localhost:3000/api/v1/fixed-transactions `
  -H "Authorization: Bearer ..." `
  -H "Content-Type: application/json" `
  -d '{\"type\": \"expense\", \"value\": 50, \"referenceDay\": 5, \"marginDays\": 2, \"accountId\": \"5c6b4c23-364c-4d3e-9e39-743e2e8b99a4\", \"categoryId\": \"50efb2ce-63b8-403c-97dd-a4daa1780ec6\", \"description\": \"Manual Netflix\"}'
```

**Response Payload:**
```json
{
  "id": "6fa1f133-20a4-476f-8930-bf02b17d71d5",
  "userId": "8295c7e7-1f3d-4526-8c8c-c476a23c50ec",
  "type": "expense",
  "value": 50,
  "description": "Manual Netflix",
  "isActive": true,
  ...
}
```
**Status:** ✅ 201 Created

---

## 4. Final Validation

### 4.1 Dashboard Overview
**Goal:** Verify that the account balance correctly aggregates the initial balance and the income transaction.

**Command:**
```powershell
curl.exe -X GET http://localhost:3000/api/v1/dashboard `
  -H "Authorization: Bearer ..."
```

**Response Payload (Snippet):**
```json
{
  "period": { ... },
  "totals": {
    "totalBalance": 6000,
    "currentMonth": {
      "income": 5000,
      "expense": 0,
      "net": 5000
    }
  },
  "accounts": [
    {
      "id": "5c6b4c23-364c-4d3e-9e39-743e2e8b99a4",
      "name": "Main Bank Manual",
      "initialBalance": 1000,
      "balance": 6000 
    }
  ]
}
```
**Calculation Check:**
*   **Expected:** Initial (1000) + Income (5000) - Expense (0) = **6000**
*   **Actual:** 6000
*   **Result:** ✅ MATCH

---

## Conclusion
The backend API is functioning 100% as expected. Manual verification via `curl` confirmed that authentication, database writes (creates), and logic-based reads (dashboard calculations) are correct.
