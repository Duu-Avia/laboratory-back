# Laboratory Management System - Backend API

A comprehensive backend API for managing laboratory test samples, reports, approval workflows, and user management. Built with **Express.js 5** and **Microsoft SQL Server**.

## Features

- **Reports Management** — Create, edit, approve, sign, reject, and archive lab test reports
- **Approval Workflow** — Multi-stage pipeline: Draft → Pending → Tested → Signed → Approved
- **Digital Signatures** — Upload and attach signature images to reports
- **PDF & Excel Generation** — Generate PDF reports and Excel exports
- **Real-time Notifications** — Server-Sent Events (SSE) for live updates
- **Role-Based Access Control** — Granular permissions per role (`superadmin`, `admin`, `senior_engineer`, `engineer`, `technician`)
- **Activity Logging** — Full audit trail of all user actions
- **Lab Types & Indicators** — Configure test types (Water, Air, Swab) with measurement indicators
- **Location & Sample Tracking** — Manage sample locations and packages
- **Soft Delete** — Data preservation with deactivation instead of hard delete
- **Transaction Support** — Data consistency with SQL Server transactions

## Tech Stack

- **Runtime:** Node.js 20 (Alpine)
- **Framework:** Express.js 5
- **Language:** JavaScript (ES Modules)
- **Database:** Microsoft SQL Server (mssql 12)
- **Auth:** JWT (httpOnly cookies) + bcryptjs
- **PDF:** pdf-lib + fontkit
- **Excel:** ExcelJS
- **Image Processing:** Sharp
- **File Upload:** Multer

## Prerequisites

- Node.js >= 20
- Microsoft SQL Server 2019+
- npm

## Installation

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env.development

# Create database tables
npm run db:setup

# (Optional) Seed sample data
npm run db:seed
```

## Configuration

| File | Purpose |
| ---- | ------- |
| `.env.example` | Template with all available options |
| `.env.development` | Local development settings |
| `.env.production` | Production deployment settings |

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8000` |
| `JWT_SECRET` | Token signing key | — |
| `DB_SERVER` | SQL Server host | `localhost` |
| `DB_DATABASE` | Database name | `laboratoryDB` |
| `DB_USER` | Database user | — |
| `DB_PASSWORD` | Database password | — |
| `DB_PORT` | SQL Server port | `1433` |
| `DB_ENCRYPT` | Encrypted connection | `false` |
| `DB_TRUST_SERVER_CERTIFICATE` | Trust self-signed certs | `true` |
| `DB_POOL_MIN` / `DB_POOL_MAX` | Connection pool size | `0` / `10` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `LOG_LEVEL` | Logging verbosity | `debug` |
| `API_PREFIX` | API route prefix | `api` |

## Available Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Start with hot-reload |
| `npm run start:dev` | Development mode |
| `npm run start:prod` | Production mode |
| `npm run db:setup` | Create all database tables |
| `npm run db:migrate` | Run migrations |
| `npm run db:migrate:prod` | Run migrations (production) |
| `npm run db:seed` | Seed sample data |
| `npm run db:user-seed` | Seed user data |
| `npm run db:reset` | Reset all data |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run validate:env` | Validate environment variables |

## API Endpoints

### Auth (`/auth`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/auth/login` | Login with email/password |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/auth/me` | Get current user info |
| `GET` | `/auth/permissions` | List all permissions |

### Reports (`/reports`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/reports/create` | Create report with samples |
| `GET` | `/reports` | List all reports |
| `GET` | `/reports/:id` | Get report details |
| `GET` | `/reports/next-id` | Get next report ID |
| `GET` | `/reports/:id/pdf` | Generate PDF |
| `GET` | `/reports/excel` | Export to Excel |
| `GET` | `/reports/archive` | List archived reports |
| `PUT` | `/reports/update/:id` | Update report |
| `PUT` | `/reports/deactive/:id` | Soft delete |
| `PUT` | `/reports/approve/:id` | Approve report |
| `PUT` | `/reports/reject/:id` | Reject report |
| `PUT` | `/reports/sign/:id` | Sign report |

### Results (`/results`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `PUT` | `/results/create-result/:id` | Save test results (bulk) |

### Lab Types (`/lab-types`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/lab-types/` | List lab types |
| `POST` | `/lab-types/` | Create lab type |
| `PUT` | `/lab-types/update/:id` | Update lab type |
| `PUT` | `/lab-types/deactive/:id` | Deactivate |
| `PUT` | `/lab-types/reactive/:id` | Reactivate |

### Indicators (`/indicators`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/indicators/` | List all indicators |
| `GET` | `/indicators/:id` | Get by lab type ID |
| `POST` | `/indicators/create-indicator` | Create indicator |
| `PUT` | `/indicators/update/:id` | Update indicator |
| `PUT` | `/indicators/deactive/:id` | Deactivate |

### Locations (`/locations`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/locations/` | List location packages |
| `GET` | `/locations/all-with-samples` | Packages with samples |
| `POST` | `/locations/` | Create package |
| `GET` | `/locations/:id` | Get package details |
| `GET` | `/locations/samples/:id` | Get samples by location |
| `POST` | `/locations/samples/update/:id` | Update location samples |
| `PUT` | `/locations/deactive/:id` | Deactivate package |
| `PUT` | `/locations/samples/deactive/:id` | Deactivate sample |

### Users (`/users`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/users/` | List all users |
| `POST` | `/users/` | Create user |
| `GET` | `/users/:id` | Get user by ID |
| `PUT` | `/users/update/:id` | Update user |
| `PUT` | `/users/deactive/:id` | Deactivate user |
| `PUT` | `/users/password/:id` | Reset password |
| `PUT` | `/users/role/:id` | Change role |
| `GET` | `/users/seniors` | Get seniors by lab type |
| `GET` | `/users/roles/list` | List all roles |
| `GET/PUT` | `/users/profile` | Get/update own profile |
| `PUT` | `/users/profile/password` | Change own password |
| `POST/GET/DELETE` | `/users/profile/signature` | Manage own signature |
| `GET` | `/users/logs` | Activity logs (admin) |
| `GET/POST/DELETE` | `/users/lab-types/:id` | Manage user lab types |
| `GET/POST/DELETE` | `/users/signature/:id` | Manage user signature |

### Notifications (`/notifications`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/notifications/` | List notifications |
| `GET` | `/notifications/unread-count` | Unread count |
| `PUT` | `/notifications/read-all` | Mark all as read |
| `PUT` | `/notifications/:id/read` | Mark one as read |
| `GET` | `/notifications/stream` | SSE stream |

### Health

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/health` | Server health |
| `GET` | `/ready` | Database readiness |

## Project Structure

```
src/
├── config/                   # Database & app configuration
│   ├── index.js              # Config loader
│   ├── connection-db.js      # SQL Server connection pool
│   ├── create-table.js       # Schema initialization
│   ├── migrate.js            # Database migrations
│   ├── dummy-data.js         # Sample data seeding
│   ├── user-dummy-data.js    # User data seeding
│   └── reset-table.js        # Database reset
│
├── controller/               # Business logic & route handlers
│   ├── auth-controller.js    # Authentication
│   ├── reports/              # Report CRUD & workflow
│   ├── indicators/           # Indicator management
│   ├── lab-types/            # Lab type management
│   ├── locations/            # Location & sample management
│   ├── users/                # User management & signatures
│   ├── samples/              # Sample operations
│   ├── generates/            # PDF & Excel generation
│   ├── notifications/        # Real-time notifications (SSE)
│   └── active-logs/          # Activity logging
│
├── middleware/                # Express middleware
│   ├── auth-middleware.js     # JWT & permission checking
│   ├── cors.js               # CORS configuration
│   ├── error-handler.js      # Centralized error handling
│   ├── request-logger.js     # HTTP request logging
│   ├── activity-logger.js    # Activity tracking
│   ├── upload-signature.js   # Signature image upload
│   └── validate.js           # Request validation
│
├── router/                   # API route definitions
│   ├── route-example.js      # Auth routes
│   ├── reports.js
│   ├── results.js
│   ├── indicators.js
│   ├── lab-types.js
│   ├── locations.js
│   ├── users.js
│   └── notifications.js
│
├── utils/                    # Utility functions
│   ├── errors.js             # Custom error classes
│   ├── logger.js             # Structured logging
│   └── response.js           # Response formatters
│
├── validators/               # Request validation schemas
│   ├── report.schema.js
│   └── indicator.schema.js
│
├── constants/                # Enums & status constants
├── fonts/                    # PDF font assets
├── templates/                # Document templates
└── index.js                  # Application entry point

migrations/                   # Database migration scripts
uploads/                      # File upload directory
assets/                       # Static assets
```

## Database Schema

16 tables with foreign key constraints and soft delete support:

- **roles** / **permissions** / **role_permissions** — RBAC system
- **users** / **user_lab_types** — User accounts & lab type assignments
- **lab_types** / **indicators** — Lab test configuration
- **reports** / **samples** / **sample_indicators** / **test_results** — Core test data
- **location_packages** / **location_samples** — Sample tracking
- **report_comments** — Report action comments
- **notifications** — User notifications
- **activity_logs** — Audit trail

## Adding New Features

1. Create route handler in `src/controller/`
2. Add validation schema in `src/validators/`
3. Register route in `src/router/`
4. Update `src/index.js` if adding a new router

## Deployment (Docker + K3s)

```bash
# 1. Build Docker image
docker build . -f dockerfile -t laboratory-be:v0.0.3

# 2. Save image as tar
docker save -o laboratory_be_v003.tar laboratory-be:v0.0.3

# 3. Transfer tar to server (e.g. via FileZilla to /root/Downloads)

# 4. Import image on server
k3s ctr --namespace k8s.io images import Downloads/laboratory_be_v003.tar

# 5. Update image version in deployment config
nano deployment-laboratory.yaml
# Change the image tag to match the new build version (e.g. laboratory-be:v0.0.3)

# 6. Apply deployment
kubectl apply -f deployment-laboratory.yaml
```

## License

ISC
