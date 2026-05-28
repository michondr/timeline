# timeline

Personal life timeline tracker. Events on a horizontal axis from birthdate into the future.

## What it does

- **Range events** — start + end date, rendered above the axis; shorter duration = closer to axis
- **Open events** — one date known, the other missing; rendered as an arrow pointing into the unknown
- **Pin events** — single date, rendered below the axis grouped by category
- **Habits** — daily red/green/gray circles synced from TickTick, with streak and completion rate per habit
- Zoom from day view to decade view, pan by scrolling or dragging
- Age circles on the axis at each birthday
- Pending list for events with a missing date you want to be reminded about
- Client-side AES-256-GCM encryption — the server never sees plaintext event names or notes

## Stack

| Layer | Tech |
|---|---|
| Backend | Symfony 8, PHP 8.4, Doctrine ORM, Symfony Messenger + Scheduler |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, SVG-based timeline rendering |
| Auth | Passkey + passphrase → PBKDF2-derived encryption key (WebCrypto) |
| Infra | Docker Compose |

## Running locally

```bash
make init          # build containers, install deps, run migrations
make up            # start everything
```

Frontend: `http://localhost:5173`  
API: `http://localhost:8000`

## TickTick habits sync

1. Open ticktick.com → DevTools → Network → any `/api/v2/habits` request → copy the full `Cookie` request header value
2. In the app topbar click the TickTick dot → paste the cookie string → Save → Sync now
3. Subsequent syncs run automatically every hour via Symfony Scheduler

Only active (non-archived) habits are synced.

## Auth model

Registration requires a passphrase in addition to a passkey. The passphrase is used client-side to derive an AES-256-GCM encryption key via PBKDF2 (200k iterations). The raw key never leaves the browser — the server stores only a bcrypt hash of a separate auth key and a small verification blob to confirm the correct passphrase on unlock. Forgetting the passphrase means permanent data loss, by design.

---

*The heavy lifting — architecture, all backend code, the SVG timeline renderer, TickTick integration, encryption model, and mobile support — was done by [Claude](https://claude.ai) (Sonnet 4.6). Ondřej provided direction, taste, and the occasional well-placed complaint.*
