# Dwipa Billing Flow

Dokumen ini merangkum aturan billing yang sekarang berlaku di repo ini:

- User baru default ke `Free`
- PAYG balance default ke `$0`
- Upgrade subscription ke `Pro` tidak menambah PAYG balance
- PAYG balance hanya bertambah saat admin menambahkan credit PAYG

## User And Billing State

```mermaid
flowchart TD
    A[User sign up] --> B[Create user]
    B --> C[Default subscription = Free]
    C --> D[Default PAYG balance = $0]

    D --> E{User action}
    E -->|Stay on Free| F[Subscription stays Free]
    E -->|Request upgrade to Pro| G[Create manual payment intent: upgrade_plan]
    E -->|Request add funds| H[Create manual payment intent: add_funds]

    G --> I{Admin approves Pro payment?}
    I -->|No| J[No state change]
    I -->|Yes| K[Subscription changes to Pro]
    K --> L[Pro quota becomes available]
    L --> M[PAYG balance stays unchanged]

    H --> N{Admin approves add-funds payment?}
    N -->|No| O[PAYG balance unchanged]
    N -->|Yes| P[Admin adds PAYG credit]
    P --> Q[PAYG balance increases]
```

## Balance Source Of Truth

```mermaid
flowchart LR
    A[Billing page /me/billing] --> B[Read subscription]
    A --> C[Read PAYG balance only]

    B --> D[Free or Pro status]
    C --> E[PAYG quota / admin-added credit]

    D --> F[Show Current Subscription card]
    E --> G[Show Balance card]

    H[Pro included quota] --> I[Usage / subscription credit flow]
    I -. not used .-> G

    J[Admin top-up PAYG credit] --> E
```

## Admin-Controlled PAYG Credit Path

```mermaid
sequenceDiagram
    participant U as User
    participant M as Main Billing UI
    participant A as Admin
    participant API as Web API
    participant DB as Billing Store

    U->>M: Click Add funds
    M->>API: POST /me/billing/manual-payments
    API->>DB: Create add_funds manual payment
    DB-->>API: Pending payment reference
    API-->>M: Payment instructions

    A->>API: Approve payment / add PAYG credit
    API->>DB: dbAddAdminUserPaygCredit(...)
    DB-->>API: Updated PAYG balance
    API-->>M: Balance can now reflect new PAYG credit
```

## Technical Endpoint To Function Mapping

```mermaid
flowchart TB
    subgraph Main["main/ frontend"]
        UI1["Settings Billing page"]
        UI2["Admin user actions / credits"]
    end

    subgraph Proxy["main/app/api/web/v1/[...path]/route.ts"]
        PX["Web API proxy"]
    end

    subgraph API["ai/src/app/api/web/v1/[...path]/route.js"]
        R1["GET /me/billing"]
        R2["POST /admin/users/:userId/credits/payg"]
    end

    subgraph Dev["ai/src/lib/webApiDev.js"]
        F1["getBilling(request)"]
        F2["addAdminUserPaygCredit(request, userId)"]
    end

    subgraph Store["ai/src/lib/adminPostgres.js"]
        D1["dbGetUserPaygCreditBalance(userId)"]
        D2["dbAddAdminUserPaygCredit(userId, body, adminEmail)"]
    end

    UI1 --> PX
    UI2 --> PX
    PX --> R1
    PX --> R2

    R1 --> F1
    R2 --> F2

    F1 --> D1
    F2 --> D2

    D1 --> B1["Return PAYG balance only"]
    D2 --> B2["Create/update payg quota and increase balance"]

    B1 --> O1["Billing response.creditBalance"]
    B2 --> O2["Admin credit adjustment response"]

    P1["Pro included quota"] -. usage only .-> F1
    P1 -. not mapped to .-> O1
```
