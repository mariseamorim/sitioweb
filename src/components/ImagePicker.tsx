'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  value: string        // base64 atual
  onChange: (base64: string) => void
}

function resizeToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = url
  })
}

export function ImagePicker({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
  }, [stream])

  useEffect(() => {
    return () => { stopStream() }
  }, [stopStream])

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      setShowCamera(true)
      // Attach stream to video after modal renders
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s
      }, 100)
    } catch {
      alert('Não foi possível acessar a câmera.')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const MAX = 800
    const resized = document.createElement('canvas')
    let w = canvas.width, h = canvas.height
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX }
      else { w = Math.round((w * MAX) / h); h = MAX }
    }
    resized.width = w; resized.height = h
    resized.getContext('2d')!.drawImage(canvas, 0, 0, w, h)
    onChange(resized.toDataURL('image/jpeg', 0.82))
    closeCamera()
  }

  function closeCamera() {
    stopStream()
    setShowCamera(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange(await resizeToBase64(file))
    e.target.value = ''
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-600">Foto</label>

      <div className="mt-1 flex gap-3 items-start">
        {/* Preview */}
        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
          {value ? (
            <img src={value} alt="preview" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="text-gray-300 text-3xl">🐄</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Enviar foto
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Usar câmera
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-100 rounded-lg hover:bg-red-50"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[4/3] object-cover bg-black"
            />
            <div className="flex gap-3 p-4">
              <button
                type="button"
                onClick={closeCamera}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capture}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg"
              >
                Capturar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
