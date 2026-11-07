// Ofertas dos fornecedores, meus pedidos/mensagens e meus fornecedores (porte de src/app/ofertas/page.tsx do site).
// Tudo lido do banco local; as ações entram na fila de envio. Só a busca de fornecedor precisa de internet.
import { useEffect, useState } from 'react'
import { Alert, Image, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brMoney, brNumber } from '@/lib/format'
import { openWhatsApp } from '@/lib/whatsapp'
import {
  addVendor, countOfferClick, listMyVendors, listOffers, listRequests, lowCategories, removeVendor, REQUEST_STATUS, searchVendors,
  setRequestStatus, setVendorLink, type FoundVendor, type MyVendor, type Offer, type SupplyRequest,
} from '@/repos/vendors'
import { useSyncState } from '@/sync'
import { isLocalId } from '@/sync/local'
import { Badge, Button, Card, Chips, Empty, Field, Muted, Notice, Screen } from '@/ui'
import { RequestQuote } from '@/ui/RequestQuote'
import { TextButton } from '@/ui/TextButton'
import { colors, font, radius, space } from '@/theme'

const OFFLINE_SEARCH = 'Sem internet. A busca de fornecedores precisa de conexão; tente de novo quando o sinal voltar.'

export default function Ofertas() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const { online } = useSyncState()
  const offers = useLive(() => listOffers(farmId), [farmId])
  const low = useLive(() => lowCategories(farmId), [farmId])
  const requests = useLive(() => listRequests(farmId), [farmId])
  const vendors = useLive(() => listMyVendors(farmId), [farmId])
  const [category, setCategory] = useState('')
  const [messageTo, setMessageTo] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const categories = [...new Set(offers.map(o => o.category))]
  const visible = offers.filter(o => !category || o.category === category)

  function callVendor(offer: Offer) {
    const phone = offer.vendor?.whatsapp || offer.vendor?.phone || ''
    countOfferClick(farmId, offer.id)
    void openWhatsApp(phone, `Olá! Vi a oferta "${offer.title}" no Anota Aí Agro e tenho interesse.`)
  }

  function closeRequest(r: SupplyRequest, status: 'fechado' | 'cancelado') {
    if (status === 'fechado') { setRequestStatus(farmId, r.id, status); return }
    Alert.alert('Cancelar este pedido?', `${r.itemName} · ${r.vendor?.companyName ?? 'fornecedor'}`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => setRequestStatus(farmId, r.id, status) },
    ])
  }

  function remove(v: MyVendor) {
    Alert.alert(`Remover ${v.companyName}?`, 'Você deixa de ver as ofertas dele e ele deixa de ver sua propriedade como cliente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeVendor(farmId, v.id) },
    ])
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: space.md }}>Insumos dos seus fornecedores e da sua região</Muted>
      {actionError ? <Notice tone="red" text={actionError} /> : null}
      {low.length > 0 ? <Notice tone="amber" text={`Estoque baixo em ${low.join(', ')}. As ofertas dessas categorias aparecem primeiro.`} /> : null}
      {categories.length > 1 ? (
        <Chips options={['', ...categories].map(c => ({ value: c, label: c || 'Todas' }))} value={category} onChange={setCategory} />
      ) : null}

      {visible.length === 0 ? (
        <Card><Empty title="Nenhuma oferta no momento" text="Peça ao seu fornecedor o link de convite ou procure por ele abaixo." /></Card>
      ) : visible.map(o => <OfferCard key={o.id} offer={o} onCall={() => callVendor(o)} />)}

      {requests.length > 0 ? (
        <View style={{ marginTop: space.xl }}>
          <Text style={sectionTitle}>Meus pedidos e mensagens</Text>
          {requests.map(r => <RequestCard key={r.id} request={r} canEdit={canEdit} onClose={status => closeRequest(r, status)} />)}
        </View>
      ) : null}

      <View style={{ marginTop: space.xl }}>
        <Text style={sectionTitle}>Meus fornecedores</Text>
        <Muted style={{ marginBottom: space.md }}>
          Seus fornecedores veem os itens do seu estoque que estão abaixo do mínimo, para oferecer a reposição. Você pode desligar para cada um.
        </Muted>
        {vendors.length === 0 ? <Muted style={{ marginBottom: space.md }}>Nenhum fornecedor ainda.</Muted> : vendors.map(v => (
          <VendorCard key={v.id} vendor={v} canEdit={canEdit}
            onMessage={() => setMessageTo(v.id)}
            onToggleMute={() => setVendorLink(farmId, v.id, { muted: !v.muted })}
            onToggleShare={() => setVendorLink(farmId, v.id, { shareStock: !v.shareStock })}
            onRemove={() => remove(v)} />
        ))}
        {canEdit ? <VendorSearch farmId={farmId} online={online} onError={setActionError} /> : null}
      </View>

      {messageTo ? <RequestQuote farmId={farmId} vendors={vendors} vendorId={messageTo} onClose={() => setMessageTo(null)} /> : null}
    </Screen>
  )
}

const sectionTitle = { fontSize: font.lg, fontWeight: '700' as const, color: colors.text, marginBottom: space.sm }
const smallText = { fontSize: font.sm, color: colors.muted }

function OfferCard({ offer: o, onCall }: { offer: Offer; onCall: () => void }) {
  const vendor = o.vendor
  const where = o.isMyVendor ? ' · seu fornecedor' : vendor?.city ? ` · ${vendor.city}` : ''
  return (
    <Card style={o.matchesLowStock ? { borderColor: '#fcd34d' } : undefined}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {o.imageUrl ? <Image source={{ uri: o.imageUrl }} style={{ width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.border }} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {o.matchesLowStock ? <Badge label="Seu estoque está baixo" tone="amber" /> : null}
            <Badge label={o.category} />
          </View>
          <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{o.title}</Text>
          {o.price ? (
            <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.green }}>
              {brMoney(o.price)}{o.unit ? <Text style={{ fontSize: font.sm, fontWeight: '400', color: colors.muted }}> / {o.unit.toLowerCase()}</Text> : null}
            </Text>
          ) : null}
          {o.description ? <Text style={{ fontSize: font.sm, color: colors.text, marginTop: 4 }}>{o.description}</Text> : null}
          <Text style={[smallText, { marginTop: 4 }]}>{vendor?.companyName ?? 'Fornecedor'}{where} · até {brDate(o.validUntil)}</Text>
        </View>
      </View>
      <Button label="Chamar no WhatsApp" onPress={onCall} style={{ marginTop: space.md }} />
    </Card>
  )
}

function RequestCard({ request: r, canEdit, onClose }: { request: SupplyRequest; canEdit: boolean; onClose: (status: 'fechado' | 'cancelado') => void }) {
  const status = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.novo
  const open = r.status === 'novo' || r.status === 'respondido'
  const isMessage = !r.supplyId && !r.quantity
  const company = r.vendor?.companyName ?? 'Fornecedor'
  // Mensagem ainda na fila de envio: só dá para encerrar depois que o servidor a receber
  const sent = !isLocalId(r.id)
  return (
    <Card style={r.status === 'respondido' ? { borderColor: '#93c5fd' } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>
            {r.itemName}{r.quantity ? <Text style={{ fontWeight: '400', color: colors.muted }}> · {brNumber(r.quantity, 0)}{r.unit ? ` ${r.unit}` : ''}</Text> : null}
          </Text>
          <Text style={smallText}>{company} · {isMessage ? 'mensagem enviada' : 'pedido'} em {brDate(r.createdAt)}</Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>
      {r.note ? (
        <View style={{ marginTop: space.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.sm }}>
          <Text style={{ fontSize: font.sm, color: colors.text }}><Text style={{ color: colors.muted }}>Você: </Text>{r.note}</Text>
        </View>
      ) : null}
      {r.reply ? (
        <View style={{ marginTop: space.sm, backgroundColor: colors.blueSoft, borderRadius: radius.sm, padding: space.sm }}>
          <Text style={{ fontSize: font.sm, color: colors.blue }}><Text style={{ fontWeight: '700' }}>{company}: </Text>{r.reply}</Text>
          {r.replyPrice !== null && r.replyPrice !== undefined ? <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.blue, marginTop: 4 }}>{brMoney(r.replyPrice)}</Text> : null}
        </View>
      ) : null}
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
          <Button label="WhatsApp" onPress={() => void openWhatsApp(r.vendor?.whatsapp || r.vendor?.phone || '', `Olá! Sobre o meu pedido de ${r.itemName} pelo Anota Aí Agro.`)} style={{ minHeight: 44 }} />
          {canEdit && sent ? <TextButton label="Resolvido" onPress={() => onClose('fechado')} /> : null}
          {canEdit && sent && r.status === 'novo' ? <TextButton label="Cancelar" tone="red" onPress={() => onClose('cancelado')} /> : null}
          {!sent ? <Muted>Aguardando envio</Muted> : null}
        </View>
      ) : null}
    </Card>
  )
}

function VendorCard({ vendor: v, canEdit, onMessage, onToggleMute, onToggleShare, onRemove }: {
  vendor: MyVendor; canEdit: boolean; onMessage: () => void; onToggleMute: () => void; onToggleShare: () => void; onRemove: () => void
}) {
  const place = [v.city, v.state].filter(Boolean).join('/')
  return (
    <Card>
      <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{v.companyName}</Text>
      <Text style={smallText}>{[v.contactName, place].filter(Boolean).join(' · ')}</Text>
      <Text style={[smallText, { marginTop: 4 }]}>
        {v.shareStock ? 'Vê seu estoque baixo' : 'Não vê seu estoque'}{v.muted ? ' · ofertas silenciadas' : ''}{v.status === 'pendente' ? ' · cadastro em análise' : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
        {canEdit ? <Button label="Mandar mensagem" onPress={onMessage} style={{ minHeight: 44 }} /> : null}
        <Button label="WhatsApp" variant="secondary" onPress={() => void openWhatsApp(v.whatsapp || v.phone, 'Olá! Te encontrei pelo Anota Aí Agro.')} style={{ minHeight: 44 }} />
      </View>
      {canEdit ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.xs }}>
          <TextButton label={v.muted ? 'Voltar a receber ofertas' : 'Silenciar ofertas'} tone="muted" onPress={onToggleMute} />
          <TextButton label={v.shareStock ? 'Esconder estoque' : 'Mostrar estoque'} tone="muted" onPress={onToggleShare} />
          <TextButton label="Remover" tone="red" onPress={onRemove} />
        </View>
      ) : null}
    </Card>
  )
}

/** Busca de fornecedores aprovados (online), com 300 ms de espera entre as teclas. */
function VendorSearch({ farmId, online, onError }: { farmId: string; online: boolean; onError: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundVendor[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const term = query.trim()

  useEffect(() => {
    if (term.length < 2) { setFound([]); return }
    if (!online) return
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      searchVendors(term)
        .then(list => { if (!cancelled) setFound(Array.isArray(list) ? list : []) })
        .catch(() => { if (!cancelled) setFound([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [term, online])

  async function add(f: FoundVendor) {
    onError('')
    setAdding(f.id)
    try {
      await addVendor(farmId, f)
      setQuery('')
      setFound([])
    } catch (e) {
      onError(e instanceof Error && e.message !== 'Sem conexão' && e.message !== 'Tempo esgotado' ? e.message : OFFLINE_SEARCH)
    } finally {
      setAdding(null)
    }
  }

  return (
    <View style={{ marginTop: space.md }}>
      <Field label="Procurar fornecedor" value={query} onChangeText={setQuery} placeholder="Nome da loja, do vendedor ou cidade" editable={online}
        hint={online ? undefined : OFFLINE_SEARCH} />
      {term.length >= 2 && online ? (
        <Card style={{ paddingVertical: space.xs }}>
          {searching && found.length === 0 ? <Muted style={{ paddingVertical: space.md }}>Procurando...</Muted>
            : found.length === 0 ? <Muted style={{ paddingVertical: space.md }}>Nenhum fornecedor encontrado.</Muted>
            : found.map((f, i) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{f.companyName}</Text>
                  <Text style={smallText}>{[f.contactName, [f.city, f.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</Text>
                  {f.description ? <Text style={smallText} numberOfLines={1}>{f.description}</Text> : null}
                </View>
                {f.linked ? <Badge label="Já é seu fornecedor" tone="green" /> : <Button label="Adicionar" variant="secondary" onPress={() => void add(f)} loading={adding === f.id} style={{ minHeight: 40 }} />}
              </View>
            ))}
        </Card>
      ) : null}
    </View>
  )
}
