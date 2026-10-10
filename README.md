# BCaaS — Business Connect as a Service

A backend gateway module that enables **third-party platforms and communities to integrate with Biznex** through authenticated APIs and Single Sign-On (SSO).

BCaaS acts as a bridge between external partner applications and the Biznex ecosystem, handling authentication, user mapping, request validation, and API communication without requiring each partner application to implement Biznex-specific integration logic.

---

## Overview

In a typical integration, users may already be authenticated within a partner platform or community. Instead of requiring them to create a separate Biznex account and log in again, BCaaS allows trusted partner applications to redirect users into Biznex through an SSO-based flow.

The gateway:

1. Receives requests from registered partner platforms.
2. Verifies that the request originated from a trusted platform.
3. Validates request integrity and freshness.
4. Maps the external user's identity to a Biznex user.
5. Creates or provisions the user when required.
6. Generates an authenticated session using JWT.
7. Provides APIs for partner applications to interact with Biznex.

This creates a reusable integration layer between Biznex and external applications.

---

## Architecture

```text
                    Partner Applications
                 ┌─────────┬─────────┬─────────┐
                 │ App A   │ App B   │ App C   │
                 └────┬────┴────┬────┴────┬────┘
                      │         │         │
                      │         │         │
                      ▼         ▼         ▼
                ┌─────────────────────────────┐
                │            BCaaS             │
                │       API Gateway Layer      │
                │                              │
                │  • Request Validation       │
                │  • Platform Verification     │
                │  • SSO Handling              │
                │  • User Mapping               │
                │  • User Provisioning          │
                │  • JWT Authentication         │
                │  • Rate Limiting              │
                └──────────────┬──────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │     Biznex       │
                     │   Backend APIs   │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   PostgreSQL DB  │
                     └──────────────────┘
```

---

## Key Features

### 🔐 Partner Authentication

Only registered and trusted partner platforms can communicate with the BCaaS gateway.

Requests are validated using platform credentials and a shared secret mechanism before they are processed.

### 🔑 Single Sign-On

BCaaS enables users authenticated through a partner platform to access Biznex without going through a separate login process.

The gateway receives the external user's identity, validates the originating platform, maps the user to the corresponding Biznex account, and establishes an authenticated session.

### 👤 User Mapping & Provisioning

External users are mapped to their corresponding Biznex users using a dedicated mapping layer.

If an eligible user does not already exist in Biznex, the system can provision the required user account before continuing the authentication flow.

### 🪪 JWT-Based Authentication

After successful validation and user mapping, BCaaS generates a JWT-based authenticated session that can be used for subsequent requests.

### 🛡️ Request Validation

The gateway validates incoming requests before forwarding or processing them.

Validation includes:

* Partner/platform verification
* HMAC-SHA256 request verification
* Timestamp validation
* Replay protection
* Required security headers
* Authentication checks
* Request rate limiting

### 🚦 Rate Limiting

Partner API traffic is rate-limited to prevent excessive requests and protect the backend from accidental or abusive traffic.

### 🔌 REST APIs

The integration layer exposes RESTful APIs that can be consumed by partner applications and internal services.

---

## API Flow

### SSO Login Flow

```text
Partner Application
        │
        │  SSO Request
        ▼
     BCaaS
        │
        ├── Verify Partner
        │
        ├── Validate Timestamp
        │
        ├── Verify HMAC Signature
        │
        ├── Find / Provision User
        │
        ├── Create JWT
        │
        ▼
     Biznex
        │
        ▼
 Authenticated User
```

---

## Example SSO Endpoint

```http
POST /web-api/bcaas/sso/login
```

The endpoint receives the user and platform information required to establish an authenticated Biznex session.

Example request structure:

```json
{
  "user": {
    "externalId": "user-123",
    "email": "user@example.com"
  },
  "platform": {
    "id": "partner-platform"
  },
  "timestamp": 1720000000
}
```

The exact request fields depend on the partner integration contract.

---

## Request Verification

Partner requests are verified using a shared-secret based HMAC-SHA256 mechanism.

Conceptually:

```text
Partner
   │
   │  Request + Timestamp
   │  + HMAC Signature
   ▼
 BCaaS
   │
   ├── Validate timestamp
   ├── Retrieve partner secret
   ├── Recreate HMAC
   ├── Compare signatures
   │
   ▼
Process Request
```

Timestamp validation prevents previously captured requests from being reused outside the permitted time window.

---

## Database Design

The system uses PostgreSQL to maintain integration and user-mapping information.

A simplified representation:

```text
BcaasClient
     │
     │  1:N
     ▼
BcaasUserMapping
     │
     │  maps to
     ▼
Biznex User
```

### BcaasClient

Stores information about registered partner platforms.

Typical information includes:

* Platform identifier
* Platform credentials
* Shared secret
* Integration status
* Configuration metadata

### BcaasUserMapping

Maintains the relationship between an external platform user and their corresponding Biznex user.

This allows the same integration layer to support users originating from multiple partner platforms.

---

## Tech Stack

| Layer                          | Technology      |
| ------------------------------ | --------------- |
| Runtime                        | Node.js         |
| Framework                      | Express.js      |
| Database                       | PostgreSQL      |
| ORM                            | Sequelize       |
| Authentication                 | JWT             |
| Request Verification           | HMAC-SHA256     |
| API Testing                    | Postman         |
| Process Management             | PM2             |
| Cloud Storage / Infrastructure | Microsoft Azure |
| API Style                      | REST            |

---

## Project Structure

```text
BcaaS/
│
├── controllers/
│   └── ...
│
├── routes/
│   └── ...
│
├── middleware/
│   └── ...
│
├── models/
│   ├── BcaasClient/
│   ├── BcaasUserMapping/
│   └── ...
│
├── config/
│   └── ...
│
├── app.js
├── package.json
└── README.md
```

> Directory names may vary depending on the current implementation.

---

## Testing

The APIs can be tested using **Postman**.

<img width="975" height="573" alt="image" src="https://github.com/user-attachments/assets/7e0e3cbc-92f3-4d67-9cbd-e02a59b57334" />
<img width="975" height="571" alt="image" src="https://github.com/user-attachments/assets/c70f4eb3-4fe4-4670-b3c5-576650fe2637" />
<img width="959" height="562" alt="Screenshot 2026-06-27 150317" src="https://github.com/user-attachments/assets/6b24d1cc-0e8e-4cbc-825d-b3fec45371bd" />
<img width="975" height="571" alt="image" src="https://github.com/user-attachments/assets/71d3036d-d1b4-47b0-939e-d9b6b8a8e21a" />
<img width="975" height="575" alt="image" src="https://github.com/user-attachments/assets/1b8b966e-e8b1-489b-82ae-39f0d1b83814" />
<img width="975" height="573" alt="image" src="https://github.com/user-attachments/assets/737c5444-5b69-42c7-a3b4-f453444bdc61" />
<img width="1013" height="593" alt="image" src="https://github.com/user-attachments/assets/0ce57194-5451-45e2-9865-4d094f9d9e9e" />
<img width="1013" height="593" alt="image" src="https://github.com/user-attachments/assets/0b33d8bf-bfd5-4bca-a429-2de65bd517f3" />

A typical request flow is:

```text
1. Register / configure partner platform
            ↓
2. Generate authenticated SSO request
            ↓
3. Send request to BCaaS
            ↓
4. Validate platform + request
            ↓
5. Map / provision user
            ↓
6. Generate JWT
            ↓
7. Access Biznex
```

---

## Engineering Highlights

### API Contract Design

Designed API contracts to allow external engineering teams to integrate their applications with Biznex without needing direct access to internal application logic.

### Integration Layer

Separated partner-specific integration concerns from the core Biznex application by introducing BCaaS as an intermediary gateway.

### User Identity Mapping

Implemented a mapping layer between external platform identities and Biznex users, allowing users from different partner applications to be recognized within Biznex.

### Secure Request Processing

Implemented layered request validation involving partner verification, HMAC signatures, timestamp checks, authentication, and rate limiting.

### Debugging & Troubleshooting

During development, requests were successfully reaching the backend but were being rejected during request verification. Debugging the request flow and verification logic revealed an incorrectly configured timestamp validation threshold. Correcting the validation configuration allowed legitimate requests to proceed through the authentication pipeline.

---
