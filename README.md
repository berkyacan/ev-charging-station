# EV Charging Station Network & Management System

## Frontend Dil Notu

- Frontend kullanıcı arayüzünde görünen tüm yeni metinler Türkçe ürün diliyle yazılmalıdır.
- Teknik enum, endpoint ve type adları İngilizce kalabilir; kullanıcıya görünen etiketler, durum metinleri, boş durumlar ve hata mesajları Türkçe olmalıdır.

## Project Description

This repository contains a university Fundamentals of Software Engineering prototype for an EV Charging Station Network & Management System.

The goal of the prototype is to demonstrate:

- system architecture
- UI design choices
- testing strategy
- working demo flow
- connection between requirements and implementation

## Architecture Summary

This project will use a modular monolith with layered clean architecture.

- `backend/`: NestJS + TypeScript + Prisma + PostgreSQL + Jest
- `frontend/`: React + TypeScript + Vite
- `docker-compose.yml`: local PostgreSQL for development

## Repository Structure

```text
.
├── backend/
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   └── shared/
│   │   ├── router/
│   │   └── styles/
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
├── docker-compose.yml
└── README.md
```

## Setup Instructions

- Backend setup steps are documented in the backend section and will expand as more modules are verified locally.
- Frontend setup:
  - `cd frontend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run dev`
- Frontend environment variables:
  - `VITE_API_BASE_URL`: backend API base URL, default expectation is `http://localhost:3000/api`
  - `VITE_GOOGLE_MAPS_API_KEY`: optional placeholder for a later map integration

## Backend Commands

Placeholder:

- Commands for install, run, test, lint, and Prisma workflows will be expanded after the backend is verified locally.

## Frontend Commands

- `cd frontend`
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Database Commands

Placeholder:

- Commands for starting PostgreSQL, running Prisma migrations, and seeding demo data will be added later.

## Demo Flow

Placeholder:

- The README will document the required vehicle registration to charging completion demo flow once the core features are implemented.

## Implemented Features

- Initial monorepo structure
- Local PostgreSQL development container
- Backend modular prototype APIs for demo workflow
- Frontend Vite + React + TypeScript scaffold with React Router
- Shared frontend API client wrapper and environment variable support

## Simulated / Not Implemented Features

- Real payment gateway integration
- Advanced operator analytics
- Microservices architecture
- Real-time streaming features
