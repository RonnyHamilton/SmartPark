# SmartPark — Smart Parking Management System
## Full-Stack Cloud & Database-Backed Parking Platform

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21%20LTS-orange.svg)](https://www.oracle.com/java/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-40%20Passed-success.svg)]()

SmartPark is an enterprise-grade smart parking management application built to resolve urban parking congestion, prevent reservation collisions, and automate parking facility administration. 

The system features **mathematical zero double-booking guarantees** enforced by PostgreSQL **GiST Spatio-Temporal Exclusion Constraints**, cryptographic session security with rotating refresh tokens, dynamic pricing, and an interactive 2D floor visualizer.

---

## ⚡ 1-Click Launch (Windows)

To start PostgreSQL 16, Adminer, the Spring Boot backend, and the React frontend simultaneously:
```cmd
run-app.cmd
```
To stop all services cleanly:
```cmd
stop-app.cmd
```

### Access URLs
- **Web Application (Frontend):** [http://localhost:5173](http://localhost:5173)
- **Backend REST API:** [http://localhost:8080/api/v1](http://localhost:8080/api/v1)
- **Swagger API Documentation:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **Database Management (Adminer):** [http://localhost:8085](http://localhost:8085)

### Pre-Seeded Demonstration Logins
| Persona | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@smartpark.local` | `Admin@12345!` | `ROLE_ADMIN` |
| **Driver / User 1** | `demo@smartpark.local` | `Demo@12345!` | `ROLE_USER` |
| **Driver / User 2** | `rohan@smartpark.local` | `Demo@12345!` | `ROLE_USER` |

---

## 📚 Mini Project Review Documentation Index

The repository includes complete engineering and review defense documentation located in [`docs/`](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs):

| Document | Description | Direct File Link |
| :--- | :--- | :--- |
| **Mini Project Review** | Comprehensive review report covering architecture, ERD, algorithms, and viva defense | [MINI_PROJECT_REVIEW.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/MINI_PROJECT_REVIEW.md) |
| **Review Demo Guide** | Chronological 15-step script to follow during review jury evaluation | [REVIEW_DEMO_GUIDE.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/REVIEW_DEMO_GUIDE.md) |
| **Viva Question Bank** | 65 technical questions across 6 categories with model engineering answers | [VIVA_QUESTIONS.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/VIVA_QUESTIONS.md) |
| **Project Architecture** | Detailed component decomposition, sequence diagrams, and data flows | [PROJECT_ARCHITECTURE.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/PROJECT_ARCHITECTURE.md) |
| **Module Catalog** | Specification of all 7 implemented modules, source files, and endpoints | [MODULE_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/MODULE_DOCUMENTATION.md) |
| **Database Architecture** | Complete 12-table catalog, columns, indexes, constraints, and Mermaid ERD | [DATABASE_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/DATABASE_DOCUMENTATION.md) |
| **REST API Reference** | Complete endpoint contracts, request/response JSON models, status codes | [API_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/API_DOCUMENTATION.md) |
| **Security Architecture** | OWASP Top 10 defense, JWT/Cookie rotation, BCrypt, IDOR, brute-force defense | [SECURITY_DOCUMENTATION.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/SECURITY_DOCUMENTATION.md) |
| **Automated Test Report**| Execution results for 40 unit, integration, and concurrency stress tests | [TESTING_REPORT.md](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/docs/TESTING_REPORT.md) |

---

## 🗄️ Ready-to-Run SQL Demonstration Scripts

A dedicated [`sql/`](file:///c:/Users/ronny/Desktop/hamilton/college/sem%203/mini%20project/sql) directory contains tested `.sql` scripts ready for live demonstration:
1. **`schema_overview.sql`** — Table catalog, primary/foreign keys, indexes, Flyway history.
2. **`user_management.sql`** — User credentials, roles, lockout security flags, vehicles, tokens.
3. **`parking_inventory.sql`** — Facilities, floors, bays, EV chargers, accessibility, pricing schedules.
4. **`booking_operations.sql`** — Active reservations ledger, live occupancy, cancellations, check-in QR logs.
5. **`conflict_demonstration.sql`** — **Proves PostgreSQL GiST exclusion constraint rejecting double-booking attempts.**
6. **`audit_trail.sql`** — Security audit trail, administrative actions, login failures.
7. **`analytics_reporting.sql`** — Revenue totals, daily volume, top customers, bay utilization.

### Running SQL via Docker CLI
```cmd
docker exec -i smartpark-postgres psql -U smartpark -d smartpark < sql\conflict_demonstration.sql
```

---

## 🛠️ Technology Stack

- **Backend:** Java 21 LTS, Spring Boot 3.4.3 (Spring Security 6, Spring Data JPA, Hibernate 6, Actuator).
- **Frontend:** React 19, TypeScript 5, Vite 7, TailwindCSS, Lucide Icons, Axios.
- **Database:** PostgreSQL 16 (Alpine), Flyway Migration Engine, `btree_gist` extension.
- **Testing:** JUnit 5, AssertJ, Spring Boot Test, Spring Security Test (40 tests, 100% pass rate).
- **Infrastructure:** Docker & Docker Compose (`smartpark-postgres`, `smartpark-adminer`).
