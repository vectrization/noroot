# NoRoot

NoRoot is a browser-based Linux learning sandbox. The current app is a static Astro frontend with notes, labs, a v86-powered Buildroot terminal, and a lab URL creator.

## Structure

```txt
frontend/   Astro app, sandbox UI, notes, tests, static assets
```

Future backend/server work can live beside it, for example:

```txt
server/     API, auth, registry, network relay
```

## Frontend

Run commands from `frontend`:

```sh
cd frontend
npm install
npm run dev
npm run build
npm run test:sandbox
```

Cloudflare Pages should use `frontend` as the project/build root.

## Notes

- Root `node_modules` can be deleted after running `npm install` in `frontend`.
- Root `.astro-dev-*.log` files are local dev logs and can be deleted.
- The sandbox currently uses the bundled Buildroot image only.
