import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

/**
 * Acción principal de la pantalla: botón en el encabezado en pantallas amplias
 * y botón flotante al alcance del pulgar en celular. Solo uno es visible a la vez.
 */
export function PrimaryAction({ label, icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <>
      <Button variant="primary" icon={icon} onClick={onClick} className="primary-action--header">
        {label}
      </Button>
      <div className="fab-slot">
        <Button variant="primary" size="lg" icon={icon} onClick={onClick} className="fab">
          {label}
        </Button>
      </div>
    </>
  );
}
