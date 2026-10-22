import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { addDays, todayISO } from '../domain/dates';
import { emptyData, type AppData } from '../domain/types';
import { FlowProvider } from '../features/flows/FlowProvider';
import { StoreProvider } from '../store/StoreProvider';
import { STORAGE_KEY } from '../store/storage';
import { ToastProvider } from '../ui/Toast';

function fixture(): AppData {
  const at = new Date().toISOString();
  const expiresAt = addDays(todayISO(), 3);
  return {
    ...emptyData(),
    clients: [
      {
        id: 'c1',
        name: 'Ana Pérez',
        phone: '5512345678',
        email: '',
        pricePerCredit: 15000,
        priceHistory: [{ price: 15000, changedAt: at }],
        notes: '',
        archived: false,
        createdAt: at,
      },
    ],
    accounts: [
      {
        id: 'a1',
        clientId: 'c1',
        alias: 'Sala',
        username: 'ana.sala',
        plan: '',
        expiresAt,
        expiryHistory: [{ previous: null, next: expiresAt, serviceId: null, changedAt: at, changedBy: '' }],
        notes: '',
        archived: false,
        createdAt: at,
      },
    ],
  };
}

function renderApp(data: AppData) {
  return render(
    <StoreProvider initialData={data}>
      <ToastProvider>
        <FlowProvider>
          <App />
        </FlowProvider>
      </ToastProvider>
    </StoreProvider>,
  );
}

const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

describe('flujos completos', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#/';
  });

  it('registrar servicio → por asignar sin cambiar vencimiento → confirmar asignación → pagar', async () => {
    const user = userEvent.setup();
    const data = fixture();
    const originalExpiry = data.accounts[0]!.expiresAt;
    renderApp(data);

    await user.click(screen.getAllByRole('button', { name: /Registrar servicio/ })[0]!);
    const sheet = await screen.findByRole('dialog', { name: 'Registrar servicio' });
    await user.selectOptions(within(sheet).getByLabelText('Cliente'), 'c1');
    expect(within(sheet).getByLabelText('Precio por crédito')).toHaveValue('150.00');
    const credits = within(sheet).getByLabelText('Créditos');
    await user.clear(credits);
    await user.type(credits, '2');
    const price = within(sheet).getByLabelText('Precio por crédito');
    await user.clear(price);
    await user.type(price, '120');
    expect(within(sheet).getByText('$240.00')).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText(/Importe pagado/), '100');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar servicio' }));
    expect(within(sheet).getByText('Selecciona cómo pagó el cliente.')).toBeInTheDocument();
    await user.selectOptions(within(sheet).getByLabelText('Método de pago'), 'cash');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar servicio' }));

    expect(await screen.findByText('Servicio registrado: por asignar en portal')).toBeInTheDocument();
    let saved = stored();
    expect(saved.services[0]).toMatchObject({ credits: 2, unitPrice: 12000, total: 24000, assignment: { status: 'pending' } });
    expect(saved.accounts[0]!.expiresAt).toBe(originalExpiry);

    const pendingList = screen.getByRole('list', { name: 'Servicios por asignar' });
    await user.click(within(pendingList).getByRole('button', { name: /Confirmar asignación/ }));
    const assign = await screen.findByRole('dialog', { name: 'Confirmar asignación' });
    const newExpiry = addDays(todayISO(), 40);
    await user.type(within(assign).getByLabelText('Vencimiento en el portal'), newExpiry);
    await user.type(within(assign).getByLabelText('Confirmado por'), 'Ceci');
    await user.click(within(assign).getByRole('button', { name: 'Confirmar asignación' }));

    expect(await screen.findByText('Asignación confirmada')).toBeInTheDocument();
    saved = stored();
    expect(saved.accounts[0]!.expiresAt).toBe(newExpiry);
    expect(saved.services[0]!.assignment).toMatchObject({ status: 'assigned', confirmedBy: 'Ceci' });
    // Asignar no cambia el saldo.
    expect(screen.getByRole('list', { name: 'Clientes con saldo' })).toHaveTextContent('$140.00');

    await user.click(within(screen.getByRole('list', { name: 'Clientes con saldo' })).getByRole('button', { name: /Registrar pago/ }));
    const pay = await screen.findByRole('dialog', { name: 'Registrar pago' });
    await user.click(within(pay).getByRole('button', { name: /Liquidar saldo/ }));
    await user.selectOptions(within(pay).getByLabelText('Método de pago'), 'transfer');
    await user.click(within(pay).getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByText('Pago de $140.00 registrado')).toBeInTheDocument();
    expect(screen.getByText('Todo cobrado')).toBeInTheDocument();
  });
});
