import { afterEach, describe, expect, it } from 'vitest';
import { loadCampaign } from '../src/core/config.js';
import { rankCandidates } from '../src/core/preferences.js';
import { clearSensitive, redact, redactDeep, registerSensitive } from '../src/core/redact.js';
import { InvalidTransitionError, StateMachine } from '../src/core/stateMachine.js';
import { normalizeTime } from '../src/core/time.js';
import type { DateAvailability } from '../src/core/types.js';
import { nextRelease, releaseCalendar } from '../src/scheduler/releaseCalendar.js';
import { at } from './harness.js';

const campaign = loadCampaign('config/mantequilla.json');

function day(date: string, times: string[]): DateAvailability {
  return { date, status: 'AVAILABLE', checkedAt: '', slots: times.map((time) => ({ date, time, partySize: 2, status: 'AVAILABLE' as const })) };
}

describe('motor de preferencias', () => {
  it('ordena por prioridad de fecha y preferencia de horario', () => {
    const ranked = rankCandidates(campaign.targets, [day('2026-11-08', ['13:00']), day('2026-11-03', ['22:00', '20:30', '21:00']), day('2026-11-06', ['19:00'])], 2);
    expect(ranked.map((c) => `${c.slot.date} ${c.slot.time}`)).toEqual([
      '2026-11-03 20:30',
      '2026-11-03 22:00',
      '2026-11-03 21:00',
      '2026-11-06 19:00',
      '2026-11-08 13:00',
    ]);
  });

  it('dentro de una fecha sin preferencias toma el primer horario', () => {
    const ranked = rankCandidates(campaign.targets, [day('2026-11-07', ['22:00', '13:00', '17:30'])], 2);
    expect(ranked[0]!.slot.time).toBe('13:00');
  });

  it('ignora otros tamaños de grupo, fechas no objetivo y duplicados', () => {
    const d = day('2026-11-07', ['13:00', '13:00']);
    d.slots.push({ date: '2026-11-07', time: '14:30', partySize: 4, status: 'AVAILABLE' });
    const ranked = rankCandidates(campaign.targets, [d, day('2026-11-05', ['20:00'])], 2);
    expect(ranked.map((c) => c.slot.time)).toEqual(['13:00']);
  });
});

describe('calendario de aperturas', () => {
  it('genera aperturas 8 días antes a las 12:00 CDMX', () => {
    const cal = releaseCalendar(campaign);
    expect(cal.map((o) => o.atLocal.slice(0, 16))).toEqual(['2026-10-26T12:00', '2026-10-29T12:00', '2026-10-30T12:00', '2026-10-31T12:00']);
    expect(cal[0]!.dates).toEqual(['2026-11-03']);
  });

  it('la próxima apertura respeta la ventana en curso', () => {
    expect(nextRelease(campaign, at('2026-10-26T12:01:00'))!.atLocal).toMatch(/^2026-10-26T12/);
    expect(nextRelease(campaign, at('2026-10-26T12:10:00'))!.atLocal).toMatch(/^2026-10-29T12/);
    expect(nextRelease(campaign, at('2026-10-31T12:10:00'))).toBeNull();
  });

  it('el piso de frecuencia de consulta se impone', () => {
    expect(campaign.polling.releasePollMs).toBeGreaterThanOrEqual(campaign.polling.minIntervalMs);
  });
});

describe('máquina de estados', () => {
  it('registra transiciones y rechaza las inválidas; CONFIRMED es terminal', async () => {
    const log: string[] = [];
    const sm = new StateMachine('IDLE', (t) => void log.push(`${t.from}>${t.to}`));
    await sm.go('INITIALIZING', 'x');
    await sm.go('READY', 'x');
    await expect(sm.go('CONFIRMED', 'x')).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(log).toEqual(['IDLE>INITIALIZING', 'INITIALIZING>READY']);
    const done = new StateMachine('CONFIRMED', () => {});
    await expect(done.go('CHECKING_AVAILABILITY', 'x')).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

describe('protección de datos', () => {
  afterEach(() => clearSensitive());
  it('oculta nombre, teléfono y correo en logs, sin romper fechas', () => {
    registerSensitive('Persona Prueba', '+52 55 1111 2222', 'prueba@example.com');
    const out = redact('Persona Prueba +52 55 1111 2222 5511112222 prueba@example.com otro@x.io 2026-11-03 20:30');
    expect(out).not.toMatch(/Persona|1111|prueba@|otro@/);
    expect(out).toContain('2026-11-03 20:30');
    expect(redactDeep({ phone: 'x', nested: { email: 'y', ok: 'z' } })).toEqual({ phone: '[REDACTED]', nested: { email: '[REDACTED]', ok: 'z' } });
  });
});

describe('normalización de horarios', () => {
  it.each([
    ['20:30', '20:30'],
    ['8:30 PM', '20:30'],
    ['1:00 p. m.', '13:00'],
    ['22.00h', '22:00'],
    ['12:00 AM', '00:00'],
    ['hola', null],
  ])('%s → %s', (input, expected) => expect(normalizeTime(input)).toBe(expected));
});

describe('widget CoverManager (formato verificado)', () => {
  it('link prellenado con fecha, personas, hora y datos', async () => {
    const { prefilledLink } = await import('../src/adapters/covermanager/link.js');
    const url = new URL(prefilledLink('mantequilla-social-club', { date: '2026-11-03', time: '20:30', partySize: 2 }, { fullName: 'Persona De Prueba', phone: '+52 55 1111 2222', email: 'p@example.com', partySize: 2, celebration: 'No' }));
    expect(url.origin + url.pathname).toBe('https://www.covermanager.com/reservation/module_restaurant/mantequilla-social-club/spanish');
    expect(Object.fromEntries(url.searchParams)).toEqual({ day: '2026-11-03', people: '2', hour: '20:30', name: 'Persona', lastname: 'De Prueba', email: 'p@example.com', phone: '5511112222', intcallcode: '52' });
  });

  it('interpreta la caja de horarios', async () => {
    const { parseHourBox } = await import('../src/adapters/covermanager/adapter.js');
    const sold = parseHourBox('2026-10-24', 2, "<label>Hora</label><div id='horas'><b>Sold out, por favor elige otra fecha.</b></div>", '');
    expect(sold.status).toBe('SOLD_OUT');
    const open = parseHourBox('2026-11-03', 2, '<select id="hour-box-select"><option value="-1">Hora</option><option value="20:30">20:30</option><option value="22:00" disabled>22:00</option></select>', '');
    expect(open.status).toBe('AVAILABLE');
    expect(open.slots.map((x) => `${x.time}:${x.status}`)).toEqual(['20:30:AVAILABLE', '22:00:SOLD_OUT']);
  });
});
