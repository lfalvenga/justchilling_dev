# Just Chilling

A collection of lightweight browser games designed around short, replayable experiences.

**Just Chilling** is a web platform that hosts independent mini-games inspired by the accessibility of daily games such as Wordle and Termo. The project prioritizes instant play, minimal loading time, and a clean architecture based on Vanilla JavaScript and Vercel Serverless Functions.

**Website:** https://www.justchilling.com.br

---

## Overview

The platform is built around three core principles:

* **Instant access** — no downloads or player accounts required.
* **Short sessions** — games are designed to be completed in a few minutes.
* **Modular architecture** — each game is isolated, making new titles easy to develop and maintain.

Instead of being a single game, Just Chilling serves as a **hub** for multiple independent experiences sharing the same infrastructure.

---

## Current Games

### Road to Statuette

A strategy and drafting game inspired by film awards, where players assemble a cast, progress through elimination rounds, and attempt to win the final Statuette.

**Features**

* Draft-based team building
* Tournament progression
* Multiple game modes
* Replay-oriented gameplay
* Fully responsive interface

---

## Project Structure

```text
just-chilling/
│
├── api/                         # Vercel Functions
│   ├── events.js                # Analytics ingestion
│   ├── metrics.js               # CRM metrics endpoint
│   ├── export.js                # CSV export
│   └── login.js                 # CRM authentication
│
├── analytics/                   # Private analytics dashboard
│   ├── crm.html
│   ├── login.html
│   ├── scripts/
│   └── styles/
│
├── hub/                         # Landing page
│   ├── assets/
│   ├── scripts/
│   ├── styles/
│   └── index.html
│
├── games/                       # Games
│   ├── roadtostatuette/
│   └── wikioculta/
│
├── robots.txt
├── sitemap.xml
└── vercel.json
```

Each game is self-contained, including its own assets, stylesheets and scripts, allowing independent development without affecting the rest of the platform.

---

## Technology Stack

| Technology         | Purpose                       |
| ------------------ | ----------------------------- |
| HTML5              |      Application structure    |
| CSS3               |      Styling and animations   |
| Vanilla JavaScript |      Game logic               |
| Vercel Functions   |      Backend APIs             |
| SQLite             |      Local analytics database |
| Vercel             |      Hosting & deployment     |

The frontend intentionally avoids frameworks to reduce complexity and maximize performance.

---

## Deployment

The project is deployed on **Vercel** using rewrites instead of framework routing.

| Route                      | Description       |
| -------------------------- | ----------------- |
| `/`                        | Just Chilling Hub |
| `/roadtostatuette`         | Road to Statuette |
| `/wikioculta`              | Upcoming game     |