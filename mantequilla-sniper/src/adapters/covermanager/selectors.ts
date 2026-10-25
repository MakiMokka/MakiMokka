/**
 * Supuestos sobre la interfaz pública de CoverManager.
 *
 * ⚠️ SIN VERIFICAR contra la página real: el entorno donde se escribió este código no tenía
 * acceso de red a covermanager.com. Todo lo que el adapter sabe de la página está aquí y se basa en
 * texto visible y roles accesibles (no en clases CSS inventadas). Antes de activar el envío
 * automático (COVERMANAGER_ADAPTER_VERIFIED=true):
 *   1. `npm run recon` desde una máquina con red → revisar recon-output/report.md
 *   2. Ajustar estas expresiones a lo observado.
 *   3. `npm run recon -- --dry-run-form <fecha-abierta-no-objetivo>` para llenar sin enviar.
 */
export const CM = {
  /** URL de frames que contienen el motor de reservas (si la página lo embebe en un iframe). */
  widgetFrameUrl: /covermanager\.com\/(reserve|reserva|module|widget)/i,

  /** Indicadores de que el widget cargó. */
  widgetReady: /personas|comensales|pax|fecha|reservar|reserva/i,

  partySizeLabel: /personas|comensales|pax|people|guests/i,

  monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  nextMonth: /siguiente|next|mes siguiente|›|»|>/i,

  /** Atributos/clases que indican un día u horario no seleccionable. */
  disabledClass: /disabled|unavailable|no-?disponible|inactive|blocked|full|completo|past/i,

  /** Botones/elementos de horario: texto con hora. */
  timeText: /^\s*\d{1,2}[:.h]\d{2}\s*(h|hrs|a\.?\s*m\.?|p\.?\s*m\.?)?\s*$/i,

  noAvailability: /no hay disponibilidad|sin disponibilidad|no quedan|completo|agotad|no availability|fully booked/i,
  waitlist: /lista de espera|waiting list|waitlist/i,

  // Sin "siguiente": ese texto también lo usa la navegación de meses del calendario.
  continueButton: /^(continuar|continue|reservar ahora|seleccionar)$/i,
  submitButton: /^(reservar|confirmar( reserva)?|finalizar( reserva)?|book|confirm)$/i,

  field: {
    fullName: /nombre( y apellidos| completo)?|name/i,
    firstName: /^nombre$|first name/i,
    lastName: /apellido|last name|surname/i,
    phone: /tel[eé]fono|m[oó]vil|celular|phone/i,
    email: /e-?mail|correo/i,
    celebration: /festejas|celebra|ocasi[oó]n especial|celebration/i,
    comments: /comentario|observaci|petici[oó]n|notas|comments/i,
  },

  /** Casillas que sí se aceptan: condiciones de la reserva / privacidad necesarias para reservar. */
  requiredConsent: /acepto|condiciones|t[eé]rminos|privacidad|pol[ií]tica/i,
  /** Casillas que nunca se marcan. */
  marketingConsent: /publicidad|newsletter|comunicaciones comerciales|ofertas|promoc|marketing/i,

  payment: /tarjeta|dep[oó]sito|prepago|pago anticipado|garant[ií]a|cargo|credit card|card|payment|stripe|cvv|cvc/i,
  paymentFrameUrl: /stripe|redsys|adyen|paycomet|checkout|payment|pago/i,

  captchaFrameUrl: /recaptcha|hcaptcha|turnstile|challenges\.cloudflare|captcha/i,
  captchaText: /no soy un robot|i'?m not a robot|verify you are human|verifica que eres humano|just a moment|checking your browser/i,
  rateLimitText: /demasiadas (solicitudes|peticiones)|too many requests|rate limit/i,
  sessionExpiredText: /sesi[oó]n (ha )?expirad|session expired|vuelve a iniciar/i,
  loginText: /inicia sesi[oó]n|iniciar sesi[oó]n|log ?in|sign in/i,

  confirmationText: /reserva (confirmada|realizada|registrada|completada)|hemos recibido tu reserva|confirmaci[oó]n de (tu |la )?reserva|booking confirmed|gracias por (tu|su) reserva/i,
  /** El identificador debe contener al menos un dígito para no capturar palabras. */
  confirmationId: /(?:localizador|c[oó]digo(?: de reserva)?|n[uú]mero de reserva|referencia|id(?: de reserva)?|booking (?:id|reference))\s*[:#]?\s*(?<id>(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{3,})/i,
  slotGoneText: /ya no (est[aá] )?disponible|no est[aá] disponible|alguien (ha|acaba de) reservar|agotad|no longer available/i,
} as const;

export function monthIndex(text: string): number {
  const t = text.toLowerCase();
  return CM.monthNames.findIndex((m) => t.includes(m));
}
