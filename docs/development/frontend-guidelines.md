# Frontend Guidelines

## Principles

- Reading comes first: the reader must stay fast, full screen, and usable with
  one hand.
- Keep controls compact and predictable; use lucide icons for common actions.
- Every user-visible string goes through i18next with a key in
  `src/i18n/locales/en.json`.
- Use TanStack Query for server state and invalidate after mutations.
- Pages compose components; components do not import pages. Put shared logic
  in `src/lib` or `src/hooks`.
- Wrap `localStorage` access with the helpers in `src/lib/storage.ts`.
- Destructive actions use `DeleteDialog`; do not build another confirmation
  flow for file removal.

## Styling

React, TypeScript, Vite, Tailwind CSS, shadcn/ui on Radix, and lucide-react.
Add primitives with the shadcn CLI and keep generated files in
`src/components/ui` close to upstream.

Use semantic theme tokens (`bg-background`, `text-muted-foreground`,
`bg-destructive`, ...) rather than raw colors, except inside the reader, which
is always dark. Keep keyboard focus visible, and make mobile touch targets at
least 36 px without relying on hover.

## Validation

```sh
make frontend-lint
make frontend-typecheck
make frontend-build
```

See [Frontend architecture](../architecture/frontend.md),
[Design](design.md), and [Testing](testing.md).
