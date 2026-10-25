import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Frame, type Locator, type Page, type Response } from 'playwright';
import { DateTime } from 'luxon';
import { errorMessage, type Logger } from '../../core/logger.js';
import { normalizeTime } from '../../core/time.js';
import type { BookingOutcome, DateAvailability, Guest, IsoDate, Slot, SlotStatus } from '../../core/types.js';
import type { BookOptions, HealthResult, RestaurantAdapter } from '../types.js';
import { CM, monthIndex } from './selectors.js';

export interface CoverManagerOptions {
  url: string;
  timezone: string;
  headless: boolean;
  screenshotDir: string;
  log: Logger;
  navigationTimeoutMs?: number;
}

/** Paso del flujo que no se pudo ubicar en la página: la lectura es UNKNOWN, nunca "sin mesas". */
export class AdapterStepError extends Error {
  constructor(
    readonly step: string,
    message: string,
  ) {
    super(`[${step}] ${message}`);
  }
}

interface Blocker {
  kind: 'captcha' | 'rate_limited' | 'session_expired' | 'login';
  detail: string;
}

/**
 * Adapter Playwright para la página pública de CoverManager.
 * Solo usa la interfaz que vería una persona: no llama endpoints internos, no evade CAPTCHA,
 * y se detiene ante cualquier verificación, login o cargo económico.
 */
export class CoverManagerAdapter implements RestaurantAdapter {
  readonly name = 'covermanager';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastStatus: number | null = null;

  constructor(private readonly o: CoverManagerOptions) {
    mkdirSync(o.screenshotDir, { recursive: true });
  }

  // ---------- ciclo de vida ----------

  async init(): Promise<void> {
    if (this.page && !this.page.isClosed() && this.browser?.isConnected()) return;
    await this.close();
    this.browser = await chromium.launch({ headless: this.o.headless });
    this.context = await this.browser.newContext({
      locale: 'es-MX',
      timezoneId: this.o.timezone,
      viewport: { width: 1280, height: 900 },
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.o.navigationTimeoutMs ?? 15_000);
    this.page.on('response', (r: Response) => {
      if (r.request().resourceType() === 'document' || r.status() === 429) this.lastStatus = r.status();
    });
    await this.open();
  }

  private async open(): Promise<void> {
    const page = this.requirePage();
    const res = await page.goto(this.o.url, { waitUntil: 'domcontentloaded' });
    this.lastStatus = res?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  private requirePage(): Page {
    if (!this.page || this.page.isClosed()) throw new AdapterStepError('page', 'Navegador no inicializado');
    return this.page;
  }

  /** El motor de reservas puede estar en la página o dentro de un iframe. */
  private root(): Frame {
    const page = this.requirePage();
    return page.frames().find((f) => CM.widgetFrameUrl.test(f.url()) && f !== page.mainFrame()) ?? page.mainFrame();
  }

  // ---------- verificaciones ----------

  private async blocker(): Promise<Blocker | null> {
    const page = this.requirePage();
    if (this.lastStatus === 429) return { kind: 'rate_limited', detail: 'HTTP 429' };
    if (page.frames().some((f) => CM.captchaFrameUrl.test(f.url()))) return { kind: 'captcha', detail: 'La página muestra un CAPTCHA/verificación' };
    const text = await this.visibleText();
    if (CM.captchaText.test(text)) return { kind: 'captcha', detail: 'Verificación anti-bot visible' };
    if (CM.rateLimitText.test(text)) return { kind: 'rate_limited', detail: 'Mensaje de límite de solicitudes' };
    if (CM.sessionExpiredText.test(text)) return { kind: 'session_expired', detail: 'Mensaje de sesión expirada' };
    return null;
  }

  private async visibleText(): Promise<string> {
    const texts = await Promise.all(
      this.requirePage()
        .frames()
        .map((f) => f.locator('body').innerText({ timeout: 3_000 }).catch(() => '')),
    );
    return texts.join('\n');
  }

  async healthCheck(): Promise<HealthResult> {
    try {
      await this.init();
      const b = await this.blocker();
      if (b?.kind === 'captcha') return { ok: false, detail: b.detail, humanActionRequired: true };
      if (b?.kind === 'rate_limited') return { ok: false, detail: b.detail, rateLimited: true };
      if (b?.kind === 'session_expired') return { ok: false, detail: b.detail, sessionExpired: true };
      if (this.lastStatus && this.lastStatus >= 400) return { ok: false, detail: `HTTP ${this.lastStatus}` };
      const text = await this.visibleText();
      if (!CM.widgetReady.test(text)) return { ok: false, detail: 'No se encontró el motor de reservas en la página' };
      return { ok: true, detail: 'Página de reservas cargada' };
    } catch (err) {
      return { ok: false, detail: errorMessage(err) };
    }
  }

  async prepare(partySize: number): Promise<void> {
    await this.init();
    await this.open();
    await this.selectPartySize(partySize);
  }

  // ---------- pasos del flujo ----------

  private async selectPartySize(n: number): Promise<void> {
    const root = this.root();
    const select = root.getByLabel(CM.partySizeLabel).first();
    if ((await select.count()) > 0 && (await select.evaluate((el) => el.tagName === 'SELECT').catch(() => false))) {
      const values = await select.locator('option').allInnerTexts();
      const label = values.find((v) => new RegExp(`^\\s*${n}\\b`).test(v));
      if (!label) throw new AdapterStepError('party', `No existe opción para ${n} personas`);
      await select.selectOption({ label });
      return;
    }
    const button = root.getByRole('button', { name: new RegExp(`^\\s*${n}(\\s*(personas|pax|comensales))?\\s*$`, 'i') }).first();
    if ((await button.count()) > 0) {
      await button.click();
      return;
    }
    throw new AdapterStepError('party', 'No se encontró el selector de personas');
  }

  private async isDisabled(el: Locator): Promise<boolean> {
    return el
      .evaluate((node, re) => {
        const e = node as HTMLElement;
        const cls = `${e.className} ${e.parentElement?.className ?? ''}`;
        return (
          (e as HTMLButtonElement).disabled === true ||
          e.getAttribute('aria-disabled') === 'true' ||
          new RegExp(re, 'i').test(cls)
        );
      }, CM.disabledClass.source)
      .catch(() => true);
  }

  /** Lleva el calendario al mes de la fecha y devuelve la celda del día. */
  private async dayCell(date: IsoDate): Promise<Locator> {
    const root = this.root();
    const target = DateTime.fromISO(date, { zone: this.o.timezone });
    for (let i = 0; i < 13; i++) {
      const text = await root.locator('body').innerText();
      const header = text.split('\n').find((l) => monthIndex(l) >= 0 && /\d{4}/.test(l));
      if (!header) throw new AdapterStepError('calendar', 'No se encontró el encabezado de mes');
      const month = monthIndex(header);
      const year = Number(header.match(/\d{4}/)![0]);
      const diff = (target.year - year) * 12 + (target.month - 1 - month);
      if (diff === 0) break;
      if (diff < 0) throw new AdapterStepError('calendar', 'El calendario muestra un mes posterior a la fecha');
      const next = root.getByRole('button', { name: CM.nextMonth }).first();
      if ((await next.count()) === 0 || (await this.isDisabled(next))) {
        // No se puede avanzar: la fecha todavía no se publica.
        throw new AdapterStepError('not_released', `El calendario no permite avanzar a ${target.toFormat('LLLL yyyy')}`);
      }
      await next.click();
    }
    const cells = root.locator('button, td, [role="gridcell"], a, div').filter({ hasText: new RegExp(`^\\s*${target.day}\\s*$`) });
    const count = await cells.count();
    if (count === 0) throw new AdapterStepError('calendar', `No se encontró el día ${target.day}`);
    // Preferir la celda más interna (sin hijos con el mismo texto) y que no sea de otro mes.
    for (let i = count - 1; i >= 0; i--) {
      const c = cells.nth(i);
      const outside = await c.evaluate((n) => /other-?month|outside|adjacent/i.test((n as HTMLElement).className)).catch(() => false);
      if (!outside) return c;
    }
    return cells.last();
  }

  private async readSlots(date: IsoDate, partySize: number): Promise<{ slots: Slot[]; waitlist: boolean; noAvailability: boolean }> {
    const root = this.root();
    await root.page().waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    const candidates = root.locator('button, a, li, [role="option"], [role="radio"], label, span').filter({ hasText: CM.timeText });
    const n = await candidates.count();
    const slots: Slot[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const el = candidates.nth(i);
      const raw = (await el.innerText().catch(() => '')).trim();
      const time = normalizeTime(raw);
      if (!time || seen.has(time)) continue;
      seen.add(time);
      const status: SlotStatus = (await this.isDisabled(el)) ? 'SOLD_OUT' : 'AVAILABLE';
      slots.push({ date, time, partySize, status, handle: raw });
    }
    const text = await this.visibleText();
    return { slots, waitlist: CM.waitlist.test(text), noAvailability: CM.noAvailability.test(text) };
  }

  private async selectDate(date: IsoDate): Promise<'ok' | SlotStatus> {
    const cell = await this.dayCell(date);
    if (await this.isDisabled(cell)) return 'SOLD_OUT';
    await cell.click();
    return 'ok';
  }

  async checkDates(dates: IsoDate[], partySize: number): Promise<DateAvailability[]> {
    const out: DateAvailability[] = [];
    await this.init();
    const b = await this.blocker();
    if (b) {
      const status: SlotStatus = 'ERROR';
      const now = new Date().toISOString();
      return dates.map((date) => ({ date, status, slots: [], checkedAt: now, detail: `${b.kind}: ${b.detail}` }));
    }
    for (const date of dates) {
      const checkedAt = new Date().toISOString();
      try {
        await this.open();
        await this.selectPartySize(partySize);
        const sel = await this.selectDate(date);
        if (sel !== 'ok') {
          out.push({ date, status: sel, slots: [], checkedAt, detail: 'Día no seleccionable en el calendario' });
          continue;
        }
        const { slots, waitlist, noAvailability } = await this.readSlots(date, partySize);
        const anyAvailable = slots.some((s) => s.status === 'AVAILABLE');
        const status: SlotStatus = anyAvailable ? 'AVAILABLE' : slots.length > 0 || noAvailability ? 'SOLD_OUT' : 'UNKNOWN';
        out.push({
          date,
          status,
          slots,
          checkedAt,
          detail: [waitlist ? 'lista de espera visible' : '', status === 'UNKNOWN' ? 'no se leyeron horarios' : ''].filter(Boolean).join('; ') || undefined,
        });
      } catch (err) {
        const notReleased = err instanceof AdapterStepError && err.step === 'not_released';
        out.push({
          date,
          status: notReleased ? 'NOT_YET_RELEASED' : err instanceof AdapterStepError ? 'UNKNOWN' : 'ERROR',
          slots: [],
          checkedAt,
          detail: errorMessage(err),
        });
        if (!notReleased) await this.screenshot(`check-${date}`);
      }
    }
    return out;
  }

  // ---------- reservación ----------

  async book(slot: Slot, guest: Guest, opts: BookOptions): Promise<BookingOutcome> {
    try {
      await this.init();
      await this.open();
      await this.selectPartySize(guest.partySize);
      const sel = await this.selectDate(slot.date);
      if (sel !== 'ok') return { kind: 'SLOT_GONE', detail: 'El día ya no es seleccionable' };
      const { slots } = await this.readSlots(slot.date, guest.partySize);
      const current = slots.find((s) => s.time === slot.time);
      if (!current || current.status !== 'AVAILABLE') return { kind: 'SLOT_GONE', detail: 'El horario ya no está disponible' };

      const root = this.root();
      await root.locator('button, a, li, [role="option"], [role="radio"], label, span').filter({ hasText: CM.timeText }).filter({ hasText: current.handle ?? slot.time }).first().click();
      await this.clickIfPresent(CM.continueButton);

      const blocker = await this.blocker();
      if (blocker?.kind === 'captcha') return { kind: 'HUMAN_ACTION_REQUIRED', reason: blocker.detail };
      if (blocker?.kind === 'rate_limited') return { kind: 'RATE_LIMITED' };
      if (blocker?.kind === 'session_expired') return { kind: 'SESSION_EXPIRED' };
      if (CM.loginText.test(await this.visibleText()) && (await root.locator('input[type="password"]').count()) > 0) {
        return { kind: 'HUMAN_ACTION_REQUIRED', reason: 'CoverManager pide iniciar sesión' };
      }

      await this.fillForm(guest);

      // Cargos/depósitos: nunca se aceptan sin autorización explícita.
      const page = this.requirePage();
      if (page.frames().some((f) => CM.paymentFrameUrl.test(f.url())) || (await root.locator('input[autocomplete="cc-number"], input[name*="card" i]').count()) > 0) {
        return { kind: 'PAYMENT_REQUIRED', detail: 'El formulario solicita datos de tarjeta' };
      }
      const formText = await this.visibleText();
      if (CM.payment.test(formText)) return { kind: 'PAYMENT_REQUIRED', detail: 'El formulario menciona depósito, garantía o cargo' };

      const missing = await this.missingRequiredFields();
      if (missing.length > 0) return { kind: 'HUMAN_ACTION_REQUIRED', reason: `Campos obligatorios sin dato autorizado: ${missing.join(', ')}` };

      const captcha = await this.blocker();
      if (captcha?.kind === 'captcha') return { kind: 'HUMAN_ACTION_REQUIRED', reason: captcha.detail };

      const submit = root.getByRole('button', { name: CM.submitButton }).last();
      if ((await submit.count()) === 0) return { kind: 'FAILED', error: 'No se encontró el botón de envío' };
      if (!opts.submit) return { kind: 'READY_NOT_SUBMITTED', detail: 'Formulario completo; envío automático deshabilitado' };

      await opts.beforeSubmit();
      await submit.click();
      return await this.awaitConfirmation();
    } catch (err) {
      await this.screenshot(`book-${slot.date}-${slot.time.replace(':', '')}`);
      return { kind: 'FAILED', error: errorMessage(err) };
    }
  }

  private async clickIfPresent(name: RegExp): Promise<void> {
    const b = this.root().getByRole('button', { name }).first();
    if ((await b.count()) > 0 && (await b.isVisible()) && (await b.isEnabled())) await b.click();
  }

  private field(re: RegExp): Locator {
    const root = this.root();
    return root.getByLabel(re).or(root.getByPlaceholder(re)).first();
  }

  private async fillForm(g: Guest): Promise<void> {
    const first = this.field(CM.field.firstName);
    const last = this.field(CM.field.lastName);
    if ((await first.count()) > 0 && (await last.count()) > 0) {
      const [firstName = '', ...rest] = g.fullName.split(/\s+/);
      await first.fill(firstName);
      await last.fill(rest.join(' '));
    } else {
      const name = this.field(CM.field.fullName);
      if ((await name.count()) === 0) throw new AdapterStepError('form', 'No se encontró el campo de nombre');
      await name.fill(g.fullName);
    }

    const phone = this.field(CM.field.phone);
    if ((await phone.count()) === 0) throw new AdapterStepError('form', 'No se encontró el campo de teléfono');
    const digits = g.phone.replace(/\D/g, '');
    // Si hay selector de prefijo, va el número nacional; si no, el número completo con +52.
    const prefix = this.root().locator('select').filter({ hasText: /\+52|méxico|mexico/i }).first();
    if ((await prefix.count()) > 0 && digits.startsWith('52')) {
      const opt = (await prefix.locator('option').allInnerTexts()).find((t) => /\+52\b|m[eé]xico/i.test(t));
      if (opt) await prefix.selectOption({ label: opt });
      await phone.fill(digits.slice(2));
    } else {
      await phone.fill(g.phone);
    }

    const email = this.field(CM.field.email);
    if ((await email.count()) === 0) throw new AdapterStepError('form', 'No se encontró el campo de correo');
    await email.fill(g.email);
    const emailConfirm = this.root().getByLabel(/confirma(r)? (e-?mail|correo)|repite/i).first();
    if ((await emailConfirm.count()) > 0) await emailConfirm.fill(g.email);

    await this.answerCelebration();

    // Solo casillas de condiciones necesarias; nunca publicidad.
    const boxes = this.root().getByRole('checkbox');
    for (let i = 0; i < (await boxes.count()); i++) {
      const box = boxes.nth(i);
      const label = await box.evaluate((n) => (n as HTMLInputElement).labels?.[0]?.innerText ?? n.closest('label')?.textContent ?? '').catch(() => '');
      if (CM.marketingConsent.test(label)) continue;
      if (CM.requiredConsent.test(label) && !(await box.isChecked())) await box.check();
    }
  }

  private async answerCelebration(): Promise<void> {
    const root = this.root();
    const select = root.getByLabel(CM.field.celebration).first();
    if ((await select.count()) > 0) {
      const isSelect = await select.evaluate((el) => el.tagName === 'SELECT').catch(() => false);
      if (isSelect) {
        const opt = (await select.locator('option').allInnerTexts()).find((t) => /^\s*no\b|ninguna|nada/i.test(t));
        if (!opt) throw new AdapterStepError('form', 'La pregunta de celebración no tiene opción "No"');
        await select.selectOption({ label: opt });
        return;
      }
    }
    const group = root.getByRole('radiogroup', { name: CM.field.celebration }).first();
    if ((await group.count()) > 0) {
      await group.getByRole('radio', { name: /^\s*no\s*$/i }).check();
      return;
    }
    // Pregunta presente pero con un control desconocido: no se adivina.
    if (CM.field.celebration.test(await root.locator('body').innerText())) {
      const no = root.getByRole('radio', { name: /^\s*no\s*$/i }).first();
      if ((await no.count()) > 0) return no.check();
      const noBtn = root.getByRole('button', { name: /^\s*no\s*$/i }).first();
      if ((await noBtn.count()) > 0) return noBtn.click();
      throw new AdapterStepError('form', 'No se pudo responder "No" a la pregunta de celebración');
    }
  }

  private async missingRequiredFields(): Promise<string[]> {
    return this.root()
      .locator('input[required], select[required], textarea[required], [aria-required="true"]')
      .evaluateAll((els) =>
        els
          .filter((e) => {
            const el = e as HTMLInputElement;
            if (el.type === 'checkbox' || el.type === 'radio') return !el.checked && !document.querySelector(`input[name="${el.name}"]:checked`);
            return !el.value;
          })
          .map((e) => (e as HTMLInputElement).labels?.[0]?.innerText?.trim() || (e as HTMLInputElement).name || e.tagName.toLowerCase()),
      )
      .catch(() => []);
  }

  private async awaitConfirmation(): Promise<BookingOutcome> {
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const text = await this.visibleText();
      if (CM.slotGoneText.test(text) && !CM.confirmationText.test(text)) return { kind: 'SLOT_GONE', detail: 'La plataforma rechazó el horario al enviar' };
      const b = await this.blocker();
      if (b?.kind === 'captcha') return { kind: 'UNCERTAIN', detail: 'CAPTCHA después de enviar' };
      if (CM.confirmationText.test(text)) {
        const id = text.match(CM.confirmationId)?.groups?.id;
        await this.screenshot('confirmation');
        if (id) return { kind: 'CONFIRMED', confirmationId: id, evidence: `Pantalla de confirmación de CoverManager (localizador ${id})` };
        return { kind: 'UNCERTAIN', detail: 'Pantalla de confirmación sin identificador visible; verificar correo' };
      }
      await this.requirePage().waitForTimeout(500);
    }
    await this.screenshot('confirmation-timeout');
    return { kind: 'UNCERTAIN', detail: 'Sin pantalla de confirmación tras 25 s' };
  }

  /** Captura con todos los campos de formulario enmascarados; se guarda localmente, nunca se publica. */
  private async screenshot(tag: string): Promise<void> {
    try {
      const page = this.requirePage();
      const masks = page.frames().map((f) => f.locator('input, textarea, select'));
      await page.screenshot({ path: join(this.o.screenshotDir, `${Date.now()}-${tag}.png`), mask: masks, fullPage: true });
    } catch (err) {
      this.o.log.warn('No se pudo tomar captura', { err: errorMessage(err) });
    }
  }
}
