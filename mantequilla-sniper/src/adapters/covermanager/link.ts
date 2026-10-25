import type { Guest, Slot } from '../../core/types.js';

/** URL del motor de reservas embebido (iframe de restaurante.covermanager.com). Verificado 24-oct-2026. */
export function widgetUrl(slug: string, language = 'spanish'): string {
  return `https://www.covermanager.com/reservation/module_restaurant/${slug}/${language}`;
}

/**
 * Link oficial de preselección del widget: abre con fecha, personas, hora y datos de contacto
 * ya llenos (parámetros day, people, hour, name, lastname, email, phone, intcallcode, verificados
 * en la página real). La persona solo revisa y confirma desde su propio navegador.
 */
export function prefilledLink(slug: string, slot: Pick<Slot, 'date' | 'time' | 'partySize'>, guest?: Guest): string {
  const q = new URLSearchParams({ day: slot.date, people: String(slot.partySize), hour: slot.time });
  if (guest) {
    const [name = '', ...rest] = guest.fullName.trim().split(/\s+/);
    const digits = guest.phone.replace(/\D/g, '');
    const intl = digits.startsWith('52') && digits.length === 12;
    q.set('name', name);
    q.set('lastname', rest.join(' '));
    q.set('email', guest.email);
    q.set('phone', intl ? digits.slice(2) : digits);
    if (intl) q.set('intcallcode', '52');
  }
  return `${widgetUrl(slug)}?${q.toString()}`;
}
