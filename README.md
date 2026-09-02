# LuxeCart

LuxeCart is a single-vendor fashion and lifestyle e-commerce platform targeting the Indian market, built with a modern modular monolith architecture.

## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS, TanStack Query, Zustand, Axios, React Hook Form, Zod, Lucide React
- **Backend**: Node.js + Express.js, MongoDB + Mongoose
- **Initial Payment Method**: Cash on Delivery (COD)

## Project Structure

```text
LuxeCart/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express backend
├── docs/            # Architecture and product documentation
├── .gitignore
├── package.json     # Root convenience scripts
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### Installation & Development

1. **Backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Server runs on `http://localhost:5000` (API base: `http://localhost:5000/api/v1`).

2. **Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Client runs on `http://localhost:5173`.

### Root Convenience Scripts
From the project root:
- `npm run dev:server` — Start backend in development mode
- `npm run dev:client` — Start frontend in development mode
- `npm run build:client` — Build frontend for production
