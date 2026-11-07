// Mensagem solta para um fornecedor vinculado (a mesma janela "Mandar mensagem" do site, src/components/RequestQuote.tsx).
// A mensagem fica guardada no aparelho e sai pela fila; a resposta volta em "Meus pedidos e mensagens".
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { openWhatsApp } from '@/lib/whatsapp'
import { sendMessage, type MyVendor } from '@/repos/vendors'
import { useSyncState } from '@/sync'
import { Button, Field, Notice, SelectField, styles } from '@/ui'
import { colors, font, space } from '@/theme'

export function RequestQuote({ farmId, vendors, vendorId: initial, onClose }: { farmId: string; vendors: MyVendor[]; vendorId: string; onClose: () => void }) {
  const { online } = useSyncState()
  const usable = vendors.filter(v => v.status !== 'bloqueado')
  const [vendorId, setVendorId] = useState<string | null>(initial || (usable.length === 1 ? usable[0].id : null))
  const [subject, setSubject] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<MyVendor | null>(null)

  function send() {
    const vendor = usable.find(v => v.id === vendorId)
    if (!vendor) { setError('Escolha o fornecedor'); return }
    if (!subject.trim()) { setError('Informe o assunto'); return }
    if (!note.trim()) { setError('Escreva a mensagem'); return }
    sendMessage(farmId, vendor, subject, note)
    setSentTo(vendor)
  }

  const whatsappText = `Olá! Mandei uma mensagem pelo Anota Aí Agro sobre ${subject.trim()}: ${note.trim()}`

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{sentTo ? 'Mensagem enviada' : 'Mandar mensagem'}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.link}>Fechar</Text></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}>
          {sentTo ? (
            <View>
              <Text style={{ fontSize: font.md, color: colors.text, lineHeight: 24 }}>
                A <Text style={{ fontWeight: '700' }}>{sentTo.companyName}</Text> já vê a mensagem no painel dela. A resposta aparece em{' '}
                <Text style={{ fontWeight: '700' }}>Ofertas → Meus pedidos</Text> e no sino.
              </Text>
              {!online ? <Notice tone="amber" text="Sem internet: a mensagem fica guardada no aparelho e sai quando o sinal voltar." /> : null}
              <Button label="Avisar também pelo WhatsApp" onPress={() => void openWhatsApp(sentTo.whatsapp || sentTo.phone, whatsappText)} style={{ marginTop: space.lg }} />
              <Button label="Fechar" variant="secondary" onPress={onClose} style={{ marginTop: space.sm }} />
            </View>
          ) : usable.length === 0 ? (
            <Text style={{ fontSize: font.md, color: colors.text }}>Você ainda não tem fornecedor no app. Procure por ele em Ofertas.</Text>
          ) : (
            <View>
              <SelectField label="Fornecedor" value={vendorId} options={usable.map(v => ({ value: v.id, label: v.companyName + (v.city ? ` (${v.city})` : '') }))} onChange={setVendorId} placeholder="Escolha" />
              <Field label="Assunto" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Ex.: arame farpado, horário de entrega" />
              <Field label="Mensagem" value={note} onChangeText={setNote} maxLength={500} multiline placeholder="Ex.: Vocês têm arame farpado? Quanto custa o rolo?" />
              {error ? <Notice tone="red" text={error} /> : null}
              <Button label="Enviar mensagem" onPress={send} disabled={!vendorId} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
