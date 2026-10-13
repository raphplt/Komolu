import { Dialog } from './shared'
export function DataPanel({ onClose }: { onClose: () => void }) { return <Dialog title="Sauvegarde et données" onClose={onClose}><p>Tes données sont enregistrées dans ce navigateur. Elles ne sont pas synchronisées entre appareils.</p><p>L’export et l’import de sauvegardes seront disponibles à l’étape de portabilité.</p></Dialog> }
