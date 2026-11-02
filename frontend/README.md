# BrewLite Frontend

Next.js App Router application for the BrewLite ordering project (React, TypeScript, Tailwind CSS v4).

## Run locally

From this directory, copy `.env.example` to `.env.local`, install the lockfile dependencies, and run:

```bash
npm ci
npm run dev
```

The app uses `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000/api`). Start the NestJS API separately for live data.

## Shared frontend interfaces

- `src/components/layout/`: shared site header and footer, rendered from the root layout.
- `src/components/providers/app-providers.tsx`: App Router client providers, including the shared TanStack Query client and auth event handling.
- `src/components/ui/`: reusable loading and error states.
- `src/components/products/product-image.tsx`: product image with a local fallback.
- `src/components/auth/require-auth.tsx`: wrap a page that requires a signed-in user; missing or expired sessions route to `/login?next=...`.
- `src/lib/api/`: typed API request, auth, and product functions. API errors expose `status`, `code`, and `details`.
- `src/store/auth-store.ts`: shared Zustand auth session interface. `useAuthStore` exposes `accessToken`, `user`, `hydrate`, `setSession`, and `signOut`.

FE2 and FE3 can reuse these components and stores. Their page routes remain owned by those teammates.

## Menu preview data

The menu calls the documented `GET /products` contract and expects `{ data, meta }`. If the API request fails, the error stays visible. The user can explicitly select “Xem dữ liệu mẫu theo tài liệu API” to preview fixtures in `src/lib/api/dev-products.ts`; they follow the documented examples and repository seed data. The page labels the preview and does not treat those records as server data.

## Scripts

- `npm run dev` — development server
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run start` — production server
