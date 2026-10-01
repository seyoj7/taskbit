---
trigger: always_on
---

# Full-Stack Application Structure

When building any full-stack application with next.js, always maintain a strict separation between the frontend and backend.

Project Structure

The root project must follow this structure:

project-root/
├── app/
│   ├── ...all frontend files and folders...
│
├── backend/
│   ├── ...all backend files and folders...
│
├── README.md
└── ...other root-level configuration files...


## Frontend Rule

All frontend-related code, files, assets, components, pages, styles, hooks, utilities, configurations, and frontend-specific dependencies must be placed inside the app/ folder.

Every page must have its own folder.
Every page folder must contain its own page.module.css.
Reusable UI components must go inside app/components/.

Example:

app/
├── components/
│   ├── Navbar/
│   │   ├── Navbar.tsx
│   │   └── Navbar.module.css
│   ├── Button/
│   │   ├── Button.tsx
│   │   └── Button.module.css
│   └── ...
│
├── home/
│   ├── home.tsx
│   └── home.module.css
│
├── about/
│   ├── about.tsx
│   └── about.module.css
│
├── contact/
│   ├── contact.tsx
│   └── contact.module.css
│
└── ...

## Backend Rule

All backend-related code must be placed inside a folder named backend.

## Separation Rule

Never mix frontend and backend files.

Frontend → app/
Backend → backend/

If a file is needed by both sides, place it in an appropriate shared/root-level location or duplicate the necessary implementation rather than incorrectly mixing frontend and backend code.