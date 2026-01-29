# Badminton Group Pre-Pay Ledger

A PWA for managing pre-payments and session costs for badminton group play.

## Features

- **Top-up Requests**: Players submit top-up requests with optional receipt photos
- **Wallet Ledger**: View transaction history and running balance
- **Session Management**: Create sessions, RSVP, auto-calculate and deduct costs
- **Push Notifications**: Low balance alerts, top-up confirmations/rejections
- **PWA**: Installable on mobile, works offline

## Tech Stack

- Next.js 14 (App Router)
- Drizzle ORM + PostgreSQL
- Supabase (Storage for receipts)
- NextAuth.js (Google, Apple sign-in)
- Firebase Cloud Messaging (Push notifications)
- Tailwind CSS + shadcn/ui
- next-pwa (Service worker)

## Getting Started

1. Clone and install dependencies:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your credentials

3. Push database schema:
   ```bash
   pnpm db:push
   ```

4. Run development server:
   ```bash
   pnpm dev
   ```

## Environment Variables

See `.env.example` for required environment variables.

## Database

- Generate migrations: `pnpm db:generate`
- Push schema: `pnpm db:push`
- Open Drizzle Studio: `pnpm db:studio`
