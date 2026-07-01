# GromoFinance Demo - Standalone Localhost Preview

## Quick Start

```bash
cd demo
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## Demo Credentials

| Field    | Value                    |
|----------|--------------------------|
| Email    | demo@gromofinance.com    |
| Password | demo123                  |

## What's Included

- **1 Admin + 5 Family Members** (Sharma Family)
- **520+ Transactions** (income, expenses, transfers, borrows, lends)
- **5 Active Loans** (Home, Car, Education, Personal, Gold)
- **10 Investments** (Mutual Funds, SIP, FD, PPF, NPS, Stocks, Gold, LIC, Real Estate, Bonds)
- **6 Insurance Policies** (Health, Term Life, Motor, Senior Citizen, PA, Critical Illness)
- **6 Financial Goals** (Emergency Fund, Vacation, Car, Education, Home, Retirement)
- **8 AI Insights** (Smart financial recommendations)

## Features

- Dark Mode (default) + Light Mode toggle
- Premium SaaS glassmorphism design
- All sections navigable:
  - Dashboard (stats, recent transactions, savings rate)
  - Transactions (full table with type badges)
  - Budgets (progress bars)
  - Loans & EMI (repayment tracking)
  - Investments (portfolio with returns)
  - Insurance (policies table)
  - Goals (progress tracker)
  - AI Insights (smart recommendations)
  - Members (family cards)
  - Reports (net worth, expense breakdown)
- Mobile responsive with collapsible sidebar
- No database required (mock data served from Express)

## Tech Stack

- Express.js (lightweight server)
- Vanilla JavaScript (no frameworks)
- CSS Variables + Glassmorphism design
- Mock API (no MongoDB needed)

## File Structure

```
demo/
├── package.json        # Dependencies
├── server.js           # Express server with mock API
├── public/
│   └── index.html      # Full demo frontend
└── README.md           # This file
```

## Deployment

This demo can be deployed to any static host or Node.js platform:
- **Vercel**: `vercel deploy`
- **Railway**: `railway deploy`
- **Render**: Connect repo, set start command to `node demo/server.js`
- **Local**: `npm start`
