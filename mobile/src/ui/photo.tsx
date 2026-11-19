// Foto do animal: miniatura na lista, foto ampliada ao tocar e campo do formulário (câmera ou galeria).
// A foto é guardada como no site: JPEG reduzido a 800 px no maior lado, em data URL.
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Alert, Image, Linking, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLive } from '@/db/events'
import { getAnimalPhoto } from '@/repos/animals'
import { colors, font, radius, space } from '@/theme'
import { Button, styles } from './index'
import { tr, useT } from '@/lib/i18n'

const MAX_SIDE = 800
const QUALITY = 0.82

/** Abre a câmera ou a galeria e devolve a foto reduzida em data URL (null = a pessoa desistiu). */
async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(tr('Câmera bloqueada'), tr('Permita o uso da câmera nas configurações do celular para tirar a foto do animal.'), [
        { text: tr('Agora não'), style: 'cancel' },
        { text: tr('Abrir configurações'), onPress: () => { void Linking.openSettings() } },
      ])
      return null
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  const context = ImageManipulator.manipulate(asset.uri)
  // Tamanho desconhecido (0) também reduz, pela largura
  if (!asset.width || !asset.height || Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.height > asset.width ? { height: MAX_SIDE } : { width: MAX_SIDE })
  }
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true })
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null
}

function Placeholder({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name="cow" size={Math.round(size * 0.55)} color={colors.green} />
    </View>
  )
}

/** Foto em tela cheia; toque em qualquer lugar fecha. */
function PhotoModal({ uri, name, onClose }: { uri: string; name: string; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const t = useT()
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityLabel={t('Fechar foto de {name}', { name })} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
        <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: '80%' }} accessibilityLabel={t('Foto de {name}', { name })} />
        <View style={{ position: 'absolute', top: insets.top + space.md, right: space.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="close" size={26} color={colors.text} />
        </View>
      </Pressable>
    </Modal>
  )
}

/** Foto do animal no tamanho pedido; tocar amplia. Sem foto, mostra o desenho do animal. */
export function PhotoView({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const [open, setOpen] = useState(false)
  const t = useT()
  if (!uri) return <Placeholder size={size} />
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={t('Ampliar foto de {name}', { name })} hitSlop={4}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.border }} />
      </Pressable>
      {open ? <PhotoModal uri={uri} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** Miniatura da lista: só busca a foto no banco quando o animal tem uma. */
export function AnimalThumb({ id, name, hasPhoto }: { id: string; name: string; hasPhoto: boolean }) {
  const uri = useLive(() => (hasPhoto ? getAnimalPhoto(id) : null), [id, hasPhoto])
  return <PhotoView uri={uri} name={name} size={48} />
}

/** Campo "Foto" do formulário: tirar com a câmera, escolher da galeria ou remover. */
export function PhotoField({ value, onChange, name }: { value: string; onChange: (dataUrl: string) => void; name: string }) {
  const [busy, setBusy] = useState<'camera' | 'library' | null>(null)
  const [error, setError] = useState('')
  const t = useT()

  async function pick(source: 'camera' | 'library') {
    setError('')
    setBusy(source)
    try {
      const photo = await pickPhoto(source)
      if (photo) onChange(photo)
    } catch {
      setError(source === 'camera' ? 'Não foi possível tirar a foto. Tente de novo.' : 'Não foi possível abrir essa foto. Tente outra.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t('Foto')}</Text>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <PhotoView uri={value || null} name={name || t('animal')} size={96} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Button label="Tirar foto" variant="secondary" onPress={() => { void pick('camera') }} loading={busy === 'camera'} disabled={busy !== null} />
          <Button label="Escolher da galeria" variant="secondary" onPress={() => { void pick('library') }} loading={busy === 'library'} disabled={busy !== null} />
          {value ? <Button label="Remover foto" variant="ghost" onPress={() => onChange('')} disabled={busy !== null} /> : null}
        </View>
      </View>
      {error ? <Text style={[styles.error, { fontSize: font.sm }]}>{error}</Text> : null}
    </View>
  )
}
