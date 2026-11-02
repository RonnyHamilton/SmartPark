# SmartPark: Technical Documentation Directory & Navigation Index

Welcome to the engineering documentation suite for the **SmartPark Smart Parking Management System**. This directory contains comprehensive academic, architectural, database, security, and verification documentation prepared for the Semester 3 Mini Project defense and ongoing engineering reference.

---

## Documentation Roadmap

```
docs/
├── MINI_PROJECT_REVIEW.md     ⭐ Master Engineering Defense & Review Document
├── PROJECT_ARCHITECTURE.md    🏛️ 3-Tier Client-Server Architecture & Mermaid Blueprints
├── DATABASE_DOCUMENTATION.md  💾 PostgreSQL 16 Schema, GiST Constraint & 12 Tables
├── API_DOCUMENTATION.md       🔌 RESTful API Endpoint Contract & RFC 7807 Models
├── MODULE_DOCUMENTATION.md    📦 9 Production Functional Modules Breakdown
├── TESTING_REPORT.md          🧪 48 Automated Tests Execution & Concurrency Report
├── SECURITY_DOCUMENTATION.md  🛡️ OWASP Mitigations, BCrypt, JWT & RBAC
├── REVIEW_DEMO_GUIDE.md       🎬 15-Step Chronological Viva Defense Script
├── VIVA_QUESTIONS.md          🎓 50+ Evaluator Questions & Defensible Answers
├── PROJECT_REPORT.md          📄 Full Academic Project Report
├── FEATURE_AUDIT.md           🔍 Audit of Verified vs Removed Legacy Features
└── UI_UX_AUDIT.md             🎨 Interface Component & Accessibility Audit
```

---

## Detailed Document Index

### 1. [MINI_PROJECT_REVIEW.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/MINI_PROJECT_REVIEW.md) ⭐
- **Primary Audience:** College Review Jury, CSE Evaluators, Project Guides.
- **Key Contents:** Executive summary, problem statement, full 9-module catalog, complete table structure report for all 12 PostgreSQL tables, mathematical proof of GiST exclusion constraint (`excl_bookings_slot_time`), 9-state booking lifecycle finite state machine, 48 automated test results, and viva cheat sheet.

### 2. [PROJECT_ARCHITECTURE.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/PROJECT_ARCHITECTURE.md)
- **Primary Audience:** Software Architects & Full-Stack Engineers.
- **Key Contents:** Detailed three-tier decoupled client-server blueprint, comprehensive Mermaid sequence diagrams for authentication, reservation, check-in/out, and background lifecycle jobs.

### 3. [DATABASE_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/DATABASE_DOCUMENTATION.md)
- **Primary Audience:** Database Administrators & Backend Developers.
- **Key Contents:** Complete relational catalog of all 12 tables, Flyway migrations (`V1` to `V4`), columns, data types, check constraints, foreign key actions (`CASCADE`, `RESTRICT`, `SET NULL`), indexes, and mathematical explanation of `btree_gist` and `tstzrange`.

### 4. [API_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/API_DOCUMENTATION.md)
- **Primary Audience:** API Consumers & Frontend Integrators.
- **Key Contents:** Complete REST API specification beneath `/api/v1` covering authentication, profiles, vehicles, facilities, availability search, quotations, bookings, gate check-in/check-out, overstay operations, and admin endpoints.

### 5. [MODULE_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/MODULE_DOCUMENTATION.md)
- **Primary Audience:** Evaluators & Module Developers.
- **Key Contents:** In-depth breakdown of all 9 verified functional modules, detailing business purpose, source files, database tables involved, and user-facing capabilities.

### 6. [TESTING_REPORT.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/TESTING_REPORT.md)
- **Primary Audience:** QA Engineers & Review Evaluators.
- **Key Contents:** Metrics for all 48 automated unit, integration, and concurrency tests (100% pass rate), suite breakdowns (`SmartParkIntegrationTest`, `NoShowAndOverstayTest`, `AllocationServiceTest`, `PricingServiceTest`, `FacilityPolicyTest`), and concurrency stress test walkthrough.

### 7. [SECURITY_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/SECURITY_DOCUMENTATION.md)
- **Primary Audience:** Security Auditors & Review Evaluators.
- **Key Contents:** OWASP Top 10 compliance analysis, BCrypt cost factor 12 hashing, ephemeral access JWTs, single-use rotating refresh tokens in `HttpOnly`, `SameSite=Strict` cookies, brute-force 5-attempt lockout, IDOR defenses, and audit trails.

### 8. [REVIEW_DEMO_GUIDE.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/REVIEW_DEMO_GUIDE.md)
- **Primary Audience:** Presenting Student on Review/Viva Day.
- **Key Contents:** Step-by-step chronological 15-minute viva demonstration script covering what to click, what to show in Adminer/terminal, what source files to reference, and exact phrases to say to evaluators.

### 9. [VIVA_QUESTIONS.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/VIVA_QUESTIONS.md)
- **Primary Audience:** Student preparing for faculty questioning.
- **Key Contents:** 50+ technical and architectural viva questions spanning database concurrency, indexing, Spring Security, React state management, and lifecycle automation with defensible answers.

---

## Live System Quick Links

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend REST API:** [http://localhost:8080/api/v1](http://localhost:8080/api/v1)
- **Swagger / OpenAPI Documentation:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **Adminer Database Explorer:** [http://localhost:8085](http://localhost:8085)
- **Demonstration SQL Directory:** [`sql/`](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/sql/)
