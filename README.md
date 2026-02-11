\# MIS System



Enterprise Management Information System



\## Structure

\- \*\*mis-front\*\* - Next.js Frontend Application

\- \*\*mis-backend\*\* - Laravel Backend API



\## Team Members

\- \*\*Manager\*\* - Backend development \& approval

\- \*\*Designer\*\* - Frontend UI/UX development



\## Development Setup



\### Frontend Setup

```bash

cd mis-front

npm install

npm run dev

```

Access: http://localhost:3000



\### Backend Setup

```bash

cd mis-backend

composer install

cp .env.example .env

php artisan key:generate

php artisan serve

```

Access: http://localhost:8000



\## Workflow Rules

1\. ❌ Never push directly to `main`

2\. ✅ Always create Pull Requests

3\. ✅ Manager approves all PRs

4\. ✅ Work on your personal branch



\## Branches

\- `main` - Production (protected)

\- `manager-dev` - Manager's development branch

\- `designer-dev` - Designer's development branch

