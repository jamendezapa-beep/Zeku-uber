# Zeku · Uber Eats

Versión de Zeku dedicada solo a Uber Eats. Es una app Next.js lista para Vercel con:

- **Pedidos**: webhook que recibe pedidos y panel para aceptarlos o rechazarlos (o aceptación automática)
- **Menú**: sube `data/menu.json` a Uber Eats
- **Tienda**: abrir o pausar
- **Reportes**: pedir reportes de ventas; Uber avisa por webhook con los links
- **Validar API keys**: botón que prueba tus credenciales scope por scope

## Desplegar en Vercel (desde el celular)

1. vercel.com → **Add New → Project** → importa `zeku-uber`.
2. En **Storage**, agrega **Upstash Redis** (Marketplace) y conéctalo al proyecto: crea `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. En **Settings → Environment Variables** agrega las de `.env.example`:
   `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`, `UBER_STORE_ID`, `UBER_SCOPES`, `ADMIN_PASSWORD`.
4. **Redeploy**.
5. Abre `https://TU-PROYECTO.vercel.app` → usuario `admin`, contraseña `ADMIN_PASSWORD` → **Validar API keys**.

## Configurar Uber

En el Uber Developer Dashboard, en la configuración de tu app, registra la URL del webhook:

```
https://TU-PROYECTO.vercel.app/api/uber/webhook
```

Uber firma cada webhook con tu client secret; la app rechaza los que no tengan una firma válida.

## Pendiente de confirmar con Uber

Las rutas de la API están en `lib/uber.ts`. Compáralas con la documentación que Uber les entregó para su integración, sobre todo los **scopes habilitados** y el **formato del menú**, porque varían según el tipo de acceso.
