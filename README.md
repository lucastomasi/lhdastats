# Donaciones de Los Herederos de Alberdi

Archivo público de [ceneka.net/losherederosdealberdi](https://ceneka.net/losherederosdealberdi): ~40.655 donaciones, totales sin devoluciones, nube de palabras, fichas de donantes, palancoins (Streamlabs) y regalos de Kick por separado.

El sitio lee JSON estático (`data/donations.json` + `data/refunds.json`). **No hace falta ninguna variable de entorno** para el sitio público: el login queda apagado (`VITE_AUTH_ENABLED=false`).

Este repo es **Vite + TanStack Start** (Nitro, preset `vercel`). No es Next.js: no uses `next build`. El comando de producción es `npm run build`.

## Local

```bash
git clone https://github.com/lucastomasi/donaciones.git
cd donaciones
npm install
npm run build
npm run dev
```

- Node **20 o 22** (Vercel/Nitro corre la función en Node 22).
- Dev: [http://127.0.0.1:8080](http://127.0.0.1:8080).
- `npm run build` pide ~4 GB de heap por el JSON (~12 MB, ~40k filas). En máquinas chicas: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.

## Concentración

La sección **Quién sostiene el archivo** se recorta con parámetros propios (no pisan el buscador). Quedan en la URL para compartir. El botón **Valores por defecto** los saca y deja el resto.

| Clave | Default | Qué hace |
| --- | --- | --- |
| `cut` | `50,80` (omitido) | 1 a 4 porcentajes del monto acumulado |
| `tips` | `100,200,500,1000` | Montos típicos a contar |
| `upto` | `200` | Umbral inclusive de abajo |
| `over` | `5000` | Umbral inclusive de arriba |
| `reps` | `10` | Mínimo de aportes para recurrentes |
| `cwhen` | (todo el archivo) | `hoy`, `ayer`, `semana`, `mes`, `ultimo` o `YYYY-MM` |
| `cfrom` / `cto` | (vacío) | Rango de calendario, moneda civil ART |
| `ccur` | `ars` (omitido) | `ars` o `usd` |
| `cdev` | `out` (omitido) | Devoluciones: `out`, `in`, `only` |

Ejemplo: `/?cut=40,90&cwhen=2026-09&ccur=usd&upto=50&over=1000&reps=5`. Las tarjetas y sus desplegables se recalculan con ese recorte.

## Vercel (sitio 24/7)

Vercel **no importa Origin** (`origin.cursor.com`). Solo GitHub, GitLab o Bitbucket.

1. Entrá a [vercel.com/new](https://vercel.com/new) con tu cuenta.
2. **Import Project** → GitHub → `lucastomasi/donaciones` → rama `main`.
3. Framework Preset: **Other** (`vercel.json` ya fija los comandos).
4. Build & Output:
   - **Install command:** `npm install --no-audit --no-fund`
   - **Build command:** `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
   - **Output directory:** vacío (Nitro escribe `.vercel/output`)
   - **Node.js version:** `22.x` (o `20.x`; ambos sirven)
5. Environment Variables: **ninguna**. No cargues `DATABASE_URL` ni keys de auth: el archivo no las usa y `DATABASE_URL` encendería Postgres/login.
6. Deploy. El URL queda tipo `https://donaciones-….vercel.app`.

Cada push a `main` vuelve a publicar.

## Origin (Cursor)

El draft de Origin de esta conversación es git privado de Cursor. **Vercel no se puede conectar a Origin.** Para dejar el sitio online hay que importar el repo de **GitHub** `lucastomasi/donaciones`. Si el código nuevo está solo en Origin, primero hay que pushearlo a GitHub y después Import Project.

## Limitaciones

- `data/donations.json` ~12 MB. El build no lo mete en el bundle de JS: se copia al serverless y se parsea una vez por instancia (en memoria).
- Hobby de Vercel: cold start + parseo del JSON tiene que entrar en el timeout de la función (suele alcanzar; el CSV completo de ~40k filas es lo más pesado).
- Kick se consulta en runtime con timeout de 4 s; si falla, el archivo igual carga.