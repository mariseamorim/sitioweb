import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useSession } from '@/auth/session'
import { api } from '@/api/client'
import { Button, Card, Empty, Muted, Notice, Row, Screen } from '@/ui'

interface FarmRow { id: string; name: string; city?: string | null; state?: string | null; owner?: string | null }

// Troca de propriedade: produtor com várias (lista da sessão) ou admin (lista do servidor, precisa de internet).
export default function Propriedade() {
  const { user, switchFarm, logout } = useSession()
  const router = useRouter()
  const [farms, setFarms] = useState<FarmRow[]>(user?.farms ?? [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'admin') return
    api<FarmRow[]>('/api/farms').then(setFarms).catch(() => setError('Sem internet: não foi possível listar as propriedades.'))
  }, [user?.role])

  async function open(id: string) {
    setBusy(id); setError('')
    try { await switchFarm(id); router.replace('/(tabs)') } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir') } finally { setBusy(null) }
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>Propriedade aberta: {user?.farmName ?? 'nenhuma'}</Muted>
      {error ? <Notice tone="red" text={error} /> : null}
      {farms.length === 0 ? <Empty title="Nenhuma propriedade" text="Cadastre uma propriedade no site ou peça acesso ao dono." /> : (
        <Card style={{ paddingVertical: 4 }}>
          {farms.map(f => <Row key={f.id} title={f.name} detail={[f.owner, f.city, f.state].filter(Boolean).join(' · ') || undefined} right={<Button label={busy === f.id ? '…' : 'Abrir'} onPress={() => void open(f.id)} disabled={!!busy} />} />)}
        </Card>
      )}
      <Button label="Sair da conta" variant="ghost" onPress={async () => { await logout(); router.replace('/login') }} />
    </Screen>
  )
}
