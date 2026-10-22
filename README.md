# PopTV · Administración

Aplicación web para administrar clientes, cuentas, créditos, vencimientos y cobros de PopTV.

El portal de PopTV no tiene API: **toda asignación se hace a mano en el portal** y después se confirma aquí.
La fecha de vencimiento capturada del portal es la fuente de verdad.

## Uso

```bash
npm install
npm run dev        # desarrollo
npm run build      # typecheck + compilación
npm run lint
npm test
```

## Estructura

- `src/domain/` — reglas de negocio puras (sin React): tipos, saldos, estados, validaciones y operaciones.
- `src/store/` — persistencia en `localStorage` y proveedor de estado.
- `src/ui/` — componentes de interfaz reutilizables.
- `src/features/` — pantallas (Hoy, Clientes, Cuentas, Cobros) y flujos (hojas de captura).
- `src/styles/tokens.css` — tokens de diseño: color, tipografía, espacios, radios y movimiento.

## Reglas clave

- 1 crédito = 30 días (referencia); el vencimiento real lo define el portal.
- Total = créditos × precio por crédito. El precio aplicado se guarda en cada movimiento.
- Cambiar el precio habitual del cliente solo afecta operaciones futuras.
- Registrar un servicio crea un cargo (y un pago si lo hubo) y queda *Por asignar*; no cambia el vencimiento.
- Confirmar la asignación cambia el estado a *Asignado*, actualiza el vencimiento y guarda quién y cuándo confirmó.

## Datos

Los datos viven en el navegador (`localStorage`). Usa **Preferencias → Descargar respaldo** con frecuencia;
el respaldo puede restaurarse en otro dispositivo.
