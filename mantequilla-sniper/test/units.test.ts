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
  it('genera aperturas a medianoche CDMX para cada regla candidata', () => {
    const cal = releaseCalendar(campaign);
    expect(cal[0]!.atLocal).toBe('2026-11-02T00:00:00.000-06:00');
    expect(cal.map((o) => o.atLocal.slice(0, 10))).toEqual(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(cal.find((o) => o.atLocal.startsWith('2026-11-06'))!.dates).toEqual(['2026-11-06', '2026-11-07']);
  });

  it('la próxima apertura respeta la ventana en curso', () => {
    expect(nextRelease(campaign, at('2026-11-02T00:01:00'))!.atLocal).toMatch(/^2026-11-02/);
    expect(nextRelease(campaign, at('2026-11-02T00:10:00'))!.atLocal).toMatch(/^2026-11-03/);
    expect(nextRelease(campaign, at('2026-11-09T00:10:00'))).toBeNull();
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
