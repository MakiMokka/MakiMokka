# Informe de viabilidad — Fases 1 y 2

Fecha: 25 de octubre de 2026.

## Limitación de la investigación

El entorno donde se construyó el sistema **no tenía acceso de red a `restaurante.covermanager.com`, `covermanager.com` ni `mantequillacdmx.com`**: la política de red los bloqueó. No fue posible abrir la página real con Playwright. Lo de abajo sale de búsquedas web públicas, no de una inspección en vivo. Nada de lo que sigue está inventado, pero tampoco está verificado contra la página.

Para cerrar la Fase 1 hay que correr `npm run recon` desde una máquina o servidor con red (ver `README.md`). Ese paso genera el reporte real de estructura, red y políticas.

## Hallazgos (fuentes públicas)

| Tema | Hallazgo | Fuente | Confianza |
|---|---|---|---|
| Capacidad | 15–16 asientos, siete turnos, solo con reserva, lunes cerrado | mantequillacdmx.com (vía buscador), Antojito, Marco Beteta | Alta |
| Turnos | 13:00, 14:30, 16:00, 17:30, 19:00, 20:30, 22:00 | Marco Beteta | Media |
| Apertura | "los turnos se liberan cada día a medianoche" | mantequillacdmx.com | Media‑alta |
| Anticipación | "todos los días a las 12am se abren las reservas **del siguiente día**" | Time Out México | Media: no queda claro si es 0 o 1 día |
| Contradicción | Una publicación de Instagram dice "se liberan a las 12 de día" | @mantequilla.sc (vía buscador) | Baja / posiblemente antigua |
| Demanda | "a las 12 ya no hay nada disponible"; usuarios reportan semanas de intentos | Marco Beteta, TikTok | Alta |
| Lista de espera | Existe; hay cancelaciones frecuentes y desde ahí asignan mesas | Marco Beteta, TikTok | Media |
| Una reserva | "una reserva por fecha y horario" | mantequillacdmx.com | Media |
| Tarjeta de garantía | Las condiciones legales de CoverManager para el restaurante indican que la reserva queda garantizada al reconfirmarse cuando se pide tarjeta | covermanager.com/legal/…/use_conditions | Media: no sabemos si este restaurante la pide |
| API oficial | CoverManager tiene API para restaurantes/integradores con API key emitida por soporte; no es pública para comensales | Documentación de terceros | Alta |
| ToS sobre automatización | No se encontró cláusula pública; hay que revisar las condiciones de uso antes de activar el modo AUTO | — | Desconocido |

## Conclusiones de viabilidad

1. **Las fechas objetivo todavía no están abiertas.** Con apertura diaria a las 00:00 y una anticipación de 0–1 días, el martes 3 abre el lunes 2 a las 00:00 (o el martes 3 a las 00:00). Ver el calendario con `npm run plan`.
2. **Hay seis oportunidades de apertura** (2, 3, 5, 6, 7 y 8 de noviembre a las 00:00 CDMX), más monitoreo de cancelaciones entre ellas.
3. **La ventana real dura segundos** (15 lugares). El sistema hace la primera consulta exactamente en T=0 con el navegador ya preparado; después consulta cada 4 s (piso de 3 s) durante 3 minutos.
4. **Un fallo de lectura nunca cuenta como "sin mesas"** (estado UNKNOWN/ERROR).
5. **Riesgos que obligan a intervención humana:** CAPTCHA o anti‑bot, una tarjeta de garantía o depósito (nunca se acepta sin autorización) y campos obligatorios desconocidos. En todos esos casos el robot se detiene y notifica.
6. **El modo AUTO está bloqueado** hasta verificar el adapter con `npm run recon -- --dry-run-form <fecha>` y poner `COVERMANAGER_ADAPTER_VERIFIED=true`. Mientras tanto opera en modo asistido: detecta la mesa y manda un aviso push/email con el link para reservar a mano.

## Qué falta para cerrar las Fases 1 y 2

- [ ] Correr `npm run recon` con red y revisar `recon-output/report.md`: frames, controles, textos de política y horizonte del calendario.
- [ ] Fijar `release.daysAheadCandidates` al valor observado (comparar el último día seleccionable con la fecha de hoy, justo antes y justo después de una medianoche).
- [ ] Confirmar si se pide tarjeta de garantía o depósito y si hay CAPTCHA.
- [ ] Ajustar `src/adapters/covermanager/selectors.ts` a lo observado y ejecutar el dry run del formulario.
- [ ] Revisar las condiciones de uso de CoverManager sobre reservas automatizadas antes de activar AUTO.
