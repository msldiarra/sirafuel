You are Bolt, an expert product engineer.

Build a production-ready, real-time web app according to the following spec.

# Product
SiraFuel – Participative fuel availability & queue management platform for Mali.

# Goals
- Show live fuel availability and queue estimates per station.
- Help people avoid useless queues.
- Give admins (CNJ / authorities / partners) a real-time cockpit.
- Must work on low-end Android + weak 3G.

# Tech Stack (enforce)

- Framework: Next.js (App Router) + TypeScript + Tailwind CSS.
- Backend: Next.js API routes / server actions.
- Database & Realtime: Supabase Postgres + Supabase Realtime.
- Auth: Supabase Auth (passwordless / OTP-ready: email or phone).
- Storage: Supabase Storage for optional photos.
- Use Supabase JS client on frontend & server.
- Keep architecture clean and ready for future USSD / WhatsApp bot integrations.

Do NOT hardcode secrets. Use environment variables for Supabase URL/KEY.

# Roles (RBAC)

- PUBLIC: no login, read-only, can send lightweight contributions.
- STATION_MANAGER: verified, can send OFFICIAL updates for assigned station(s).
- TRUSTED_REPORTER: CNJ/associations, higher weight updates.
- ADMIN: full dashboard, manage stations, users, alerts.

# Data Models (Supabase / Prisma-style schema)

Implement these tables in Supabase (and generate types):

Station
- id (uuid, pk)
- name (text)
- brand (text, nullable)
- city (text)
- area (text)
- latitude (float8)
- longitude (float8)
- is_active (bool, default true)
- created_at, updated_at (timestamptz)

StationStatus
- id (uuid, pk)
- station_id (fk -> Station)
- fuel_type (enum: ESSENCE, GASOIL)
- availability (enum: AVAILABLE, LIMITED, OUT)
- pumps_active (int, nullable)
- waiting_time_min (int, nullable)
- waiting_time_max (int, nullable)
- reliability_score (int, default 0)
- last_update_source (enum: OFFICIAL, TRUSTED, PUBLIC)
- updated_at (timestamptz)

UserProfile
- id (uuid, pk)
- auth_user_id (uuid, unique, from Supabase auth.users)
- email_or_phone (text)
- role (enum: PUBLIC, STATION_MANAGER, TRUSTED_REPORTER, ADMIN)
- station_id (fk -> Station, nullable, for managers)
- is_verified (bool, default false)
- created_at

Contribution
- id (uuid, pk)
- station_id (fk -> Station)
- user_id (fk -> UserProfile, nullable)
- source_type (enum: PUBLIC, TRUSTED, OFFICIAL)
- queue_category (enum: Q_0_10, Q_10_30, Q_30_60, Q_60_PLUS, nullable)
- fuel_status (enum: AVAILABLE, LIMITED, OUT, nullable)
- photo_url (text, nullable)
- created_at (timestamptz)

Alert
- id (uuid, pk)
- station_id (fk -> Station)
- type (enum: NO_UPDATE, HIGH_WAIT, CONTRADICTION)
- status (enum: OPEN, RESOLVED)
- created_at, resolved_at (timestamptz)

Configure Supabase Realtime on StationStatus, Contribution, Alert.

# Public UI (PWA, no login)

## Home (/)
- Detect or select city.
- Filter: Essence / Gasoil.
- Show list + simple map.
For each station:
  - name
  - status icon: 🟢 AVAILABLE, 🟡 LIMITED, 🔴 OUT, ⚪ UNKNOWN
  - fuel types
  - estimated waiting time "X–Y min"
  - distance (if geolocation allowed)
  - last update: "il y a N min"
  - reliability: High / Medium / Low

Subscribe via Supabase Realtime:
- Listen to changes on StationStatus for live updates.
- Update the list/map in real time.

## Station Detail (/station/[id])
- Station info + "Open in Maps".
- Per fuel type: AVAILABLE / LIMITED / OUT.
- Waiting time range.
- Queue level indicator: short / medium / long / saturated.
- Last 3 updates: time + source.
- Contribution block (no friction):
  - Buttons: "Il y a du carburant", "Rupture",
    "File: 0–10 / 10–30 / 30–60 / 60+",
    "Je viens d’être servi".
  - Optional photo upload → Supabase Storage.
- Throttle anonymous contributions (per IP/device).
- Subscribe to realtime changes for this station only.

# Auth & Protected Areas

Use Supabase Auth.

## /login
- Basic login form.
- Integrate with Supabase auth (email or phone OTP; can be mocked for now).

## /manager
- Require STATION_MANAGER.
- Show assigned station(s).
- Form to send OFFICIAL update:
  - fuel availability per type
  - pumps_active
- On submit:
  - write to StationStatus with last_update_source=OFFICIAL.
  - Insert Contribution with source_type=OFFICIAL.
  - Supabase Realtime should broadcast to clients.

## /trusted
- Require TRUSTED_REPORTER.
- Map/list of nearby stations.
- Can send TRUSTED updates (queue_category, fuel_status).
- Same realtime flow.

# Admin Dashboard (/admin)

Protected (ADMIN role).

## Overview
- KPI cards:
  - stations with fuel / total
  - stations OUT
  - avg waiting time
  - stations no update > 60 min
  - contributions last 2h
- Data powered live with Supabase Realtime subscriptions.

## Map
- Stations colored by status and tension.
- Click → side panel with latest StationStatus, contributions, reliability_score.

## Table
- Station, City, Status, Wait ETA, Reliability, LastUpdate, Contributions(2h).
- Filters: RUPTURE, HIGH WAIT, NO UPDATE.

## Alerts
- List open alerts from Alert.
- Button to mark RESOLVED (update row -> broadcast realtime).

## Users
- Simple CRUD for UserProfile:
  - set role, link STATION_MANAGER to station.
  - toggle is_verified.

# Business Logic

Implement server utilities (can be in /lib):

1. computeWaitingTime(station_id)
- Based on latest queue_category + pumps_active + config avgMinutesPerVehicle.
- Store results in StationStatus.waiting_time_min/max.

2. computeReliabilityScore(station_id)
- Weight OFFICIAL > TRUSTED > PUBLIC.
- Penalize old updates and contradictions.
- Map to High / Medium / Low.

3. generateAlerts()
- NO_UPDATE: no StationStatus update > 60–90 min.
- HIGH_WAIT: waiting_time_max > threshold (e.g. 90).
- CONTRADICTION: conflicting updates in short window.

Invoke recompute functions on each new Contribution / StationStatus update.

# UX/UI

- Mobile-first, clean, high-contrast.
- Crisis-dashboard aesthetic, but calm.
- Small, reusable components with Tailwind.
- Avoid heavy bundles; prioritize performance.

# Deliverables

- Next.js app with:
  - public PWA (home + station detail),
  - /login,
  - /manager,
  - /trusted,
  - /admin.
- Supabase client setup.
- Realtime subscriptions wired on StationStatus (and others where helpful).
- SQL or migration for tables.
- Minimal RLS policies stubs for roles (comment in code).