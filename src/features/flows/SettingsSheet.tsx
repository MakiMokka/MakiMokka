import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { todayISO } from '../../domain/dates';
import { setOperatorName } from '../../domain/operations';
import type { AppData } from '../../domain/types';
import { useStore } from '../../store/StoreProvider';
import { parseData } from '../../store/storage';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

export function downloadJSON(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { data, commit, replaceAll } = useStore();
  const toast = useToast();
  const [name, setName] = useState(data.settings.operatorName);
  const [pending, setPending] = useState<AppData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = () => {
    const error = commit((d) => setOperatorName(d, name));
    if (error) toast.error('No se guardó', error);
    else {
      toast.success('Preferencias guardadas');
      onClose();
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseData(await file.text()));
    } catch (e) {
      toast.error('No se pudo leer el respaldo', e instanceof Error ? e.message : undefined);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Preferencias y respaldo"
      onSubmit={saveName}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            Guardar
          </Button>
        </>
      }
    >
      <div className="form-group">
        <TextField
          label="Tu nombre"
          value={name}
          onValueChange={setName}
          autoComplete="name"
          hint="Se usa para registrar quién confirmó cada asignación."
          data-autofocus
        />
      </div>
      <div className="form-group">
        <h3 className="form-group__title">Respaldo de datos</h3>
        <p className="muted">
          Los datos se guardan en este navegador. Descarga un respaldo con frecuencia y restáuralo para usarlos en otro dispositivo.
        </p>
        <div className="quick-actions">
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => downloadJSON(JSON.stringify(data, null, 2), `poptv-respaldo-${todayISO()}.json`)}
          >
            Descargar respaldo
          </Button>
          <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
            Restaurar respaldo
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title="¿Reemplazar los datos actuales?"
        message={
          pending && (
            <>
              El respaldo contiene {pending.clients.length} clientes, {pending.accounts.length} cuentas y {pending.movements.length}{' '}
              movimientos. Los datos actuales de este navegador se sustituirán.
            </>
          )
        }
        confirmLabel="Reemplazar datos"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const error = replaceAll(pending);
          setPending(null);
          if (error) toast.error('No se restauró el respaldo', error);
          else {
            toast.success('Respaldo restaurado');
            onClose();
          }
        }}
      />
    </Sheet>
  );
}
