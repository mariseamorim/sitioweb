// Avatar do usuário (como src/components/Avatar.tsx do site): a foto, ou um círculo colorido com as iniciais.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Image, Linking, Text, View } from 'react-native'
import { tr } from '@/lib/i18n'

/** Iniciais do nome: primeira e última palavra (ignora "de", "da", "dos"...) */
export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/)
    .filter((p) => !/^(dr|dra|sr|sra|prof|profa|eng|vet)\.?$/i.test(p))
    .filter((p) => p.length > 2 || p === p.toUpperCase())
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

// A cor do círculo vem do nome: cada pessoa sempre com a mesma cor (as mesmas do site)
const COLORS = ['#15803d', '#1d4ed8', '#ea580c', '#7c3aed', '#e11d48', '#0f766e']
const colorOf = (name: string) => COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length]

export function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#ffffff' }} accessibilityIgnoresInvertColors />
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(name || '?'), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: Math.round(size * 0.38) }}>{initials(name)}</Text>
    </View>
  )
}

/** Câmera ou galeria → quadrado de 256 px cortado no centro, JPEG em data URL (null = desistiu) */
export async function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(tr('Câmera bloqueada'), tr('Permita o uso da câmera nas configurações do celular para tirar a foto.'), [
        { text: tr('Agora não'), style: 'cancel' },
        { text: tr('Abrir configurações'), onPress: () => { void Linking.openSettings() } },
      ])
      return null
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  const context = ImageManipulator.manipulate(asset.uri)
  if (asset.width && asset.height && asset.width !== asset.height) {
    const side = Math.min(asset.width, asset.height)
    context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side })
  }
  context.resize({ width: 256, height: 256 })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true })
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null
}
