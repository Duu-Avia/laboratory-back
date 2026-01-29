# Laboratory Test Sample Management System - Backend API

A professional backend API for managing laboratory test samples, reports, and indicators. Built with Express.js and Microsoft SQL Server.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)

## Features

- Sample type management (Water, Air, Swab testing)
- Test indicator configuration with limits and units
- Report creation and management with multi-sample support
- PDF report generation
- Excel export functionality
- Location-based sample tracking
- Soft delete for data integrity
- Transaction support for data consistency

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5
- **Database:** Microsoft SQL Server
- **PDF Generation:** pdf-lib
- **Excel Export:** ExcelJS
- **Environment:** dotenv

## Prerequisites

- Node.js >= 18.0.0
- Microsoft SQL Server 2019+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd laboratory-back
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment configuration:
```bash
# Copy the example environment file
cp .env.example .env.development

# Edit with your database credentials
```

4. Initialize the database:
```bash
# Create database tables
npm run db:setup

# (Optional) Seed with sample data
npm run db:seed
```

## Configuration

The application uses environment-specific configuration files:

| File | Purpose |
|------|---------|
| `.env.example` | Template with all available options |
| `.env.development` | Local development settings |
| `.env.test` | Automated testing configuration |
| `.env.production` | Production deployment settings |

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment name | `development` |
| `PORT` | Server port | `8000` |
| `DB_SERVER` | SQL Server host | `localhost` |
| `DB_DATABASE` | Database name | `laboratoryDB` |
| `DB_USER` | Database user | `app_user` |
| `DB_PASSWORD` | Database password | `your_password` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PORT` | SQL Server port | `1433` |
| `DB_ENCRYPT` | Use encrypted connection | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `LOG_LEVEL` | Logging verbosity | `debug` |

## Running the Application

### Development

```bash
# Windows
npm run dev:win

# Linux/Mac
npm run dev
```

The server will start with hot-reload enabled on `http://localhost:8000`.

### Production

```bash
npm start
```

### Validate Environment

```bash
npm run validate:env
```

## API Endpoints

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/reports/create` | Create new report with samples |
| `GET` | `/reports` | List all reports |
| `GET` | `/reports/:id` | Get report details |
| `PUT` | `/reports/edit/:id` | Update report |
| `PUT` | `/reports/delete/:id` | Soft delete report |
| `PUT` | `/reports/results/:id` | Save test results |
| `GET` | `/reports/:id/pdf` | Generate PDF |
| `GET` | `/reports/excel` | Export to Excel |
| `GET` | `/reports/archive` | Archive report |

### Sample Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sample-types` | List all sample types |

### Indicators

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/indicators` | List all indicators |
| `GET` | `/indicators/:id` | Get indicators by sample type |
| `POST` | `/indicators/create-indicator` | Create new indicator |

### Locations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/locations` | List location packages |
| `GET` | `/locations/:id` | Get location package details |
| `GET` | `/locations/samples/:id` | Get samples by location |

## Project Structure

```
laboratory-back/
├── src/
│   ├── config/           # Configuration and database setup
│   │   ├── index.js      # Configuration loader
│   │   ├── connection-db.js
│   │   ├── create-table.js
│   │   └── dummy-data.js
│   │
│   ├── controller/       # Route handlers (business logic)
│   │   ├── reports.js
│   │   ├── sample.js
│   │   ├── create-indicator.js
│   │   ├── generate-pdf.js
│   │   └── generate-excel.js
│   │
│   ├── middleware/       # Express middleware
│   │   ├── index.js
│   │   ├── error-handler.js
│   │   ├── request-logger.js
│   │   ├── cors.js
│   │   └── validate.js
│   │
│   ├── router/           # Express route definitions
│   │   ├── indicators.js
│   │   ├── reports.js
│   │   ├── sample-types.js
│   │   └── locations.js
│   │
│   ├── utils/            # Utility functions
│   │   ├── index.js
│   │   ├── errors.js     # Custom error classes
│   │   ├── logger.js     # Structured logging
│   │   └── response.js   # Response formatters
│   │
│   ├── validators/       # Request validation schemas
│   │   ├── index.js
│   │   ├── report.schema.js
│   │   └── indicator.schema.js
│   │
│   └── index.js          # Application entry point
│
├── assets/               # Static assets
│   ├── fonts/
│   └── templates/
│
├── .env.example          # Environment template
├── .env.development      # Development config
├── .env.production       # Production config
├── .gitignore
├── package.json
└── README.md
```

## Development

### Code Style

The project uses ESLint for code quality. Run linting with:

```bash
npm run lint
npm run lint:fix
```

### Database Commands

```bash
# Create/update tables
npm run db:setup

# Seed sample data
npm run db:seed

# Reset all data
npm run db:reset
```

### Adding New Features

1. Create route handler in `src/controller/`
2. Add validation schema in `src/validators/`
3. Register route in `src/router/`
4. Update `src/index.js` if adding new router

## Deployment

### Pre-deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database credentials
- [ ] Set `DB_ENCRYPT=true` for encrypted connections
- [ ] Configure production CORS origins
- [ ] Set `LOG_LEVEL=info` or `warn`
- [ ] Review rate limiting settings

### Environment Security

- Never commit `.env` files with real credentials
- Use environment variables in production (e.g., Azure App Service, Docker)
- Consider using Azure Key Vault or similar for secrets management

## License

ISC
