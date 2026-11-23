import { prisma } from '@/lib/prisma'
import { closeOpenPregnancy, findValidMother } from '@/lib/calves'
import { animalCategory, animalRuleError, cleanBreed } from '@/lib/animalRules'
import { cleanCustomCode, duplicateCodeMessage } from '@/lib/animalCode'

// Cadastro de animal numa propriedade (as mesmas regras para o produtor, em /api/animals, e para o veterinário,
// em /api/veterinario/animais): campos obrigatórios, categoria pela idade e sexo, raça só de bovino,
// mãe válida, código automático e código próprio sem repetir.

type Result = { animal: Awaited<ReturnType<typeof prisma.animal.create>> } | { error: string; status: number }

/** Próximo código numérico da propriedade ("01", "02"...) */
async function nextCode(farmId: string) {
  const existing = await prisma.animal.findMany({ where: { farmId }, select: { code: true } })
  const max = existing.reduce((acc, item) => {
    const n = Number.parseInt(item.code, 10)
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return String(max + 1).padStart(2, '0')
}

export async function createAnimal(farmId: string, body: Record<string, unknown>): Promise<Result> {
  const { code, name, species, gender, birthDate, status, gta, observations, imageUrl, motherId, isCastrated = false, acquisitionType = 'nascimento' } = body
  if (!name || !species || !gender || !birthDate || !status) return { error: 'Campos obrigatórios faltando', status: 400 }
  if (typeof species !== 'string' || typeof gender !== 'string' || typeof birthDate !== 'string' || typeof isCastrated !== 'boolean' || typeof acquisitionType !== 'string') {
    return { error: 'Dados do animal inválidos', status: 400 }
  }
  const classification = { species, gender, birthDate, isCastrated, acquisitionType }
  const ruleError = animalRuleError(classification)
  if (ruleError) return { error: ruleError, status: 400 }
  // Cria registrada a partir da vaca
  if (motherId && !(await findValidMother(String(motherId), farmId))) {
    return { error: 'A mãe deve ser uma fêmea bovina da propriedade com pelo menos 2 anos e meio', status: 400 }
  }
  try {
    const animal = await prisma.animal.create({
      data: {
        farmId,
        code: (typeof code === 'string' && code) || await nextCode(farmId),
        name: String(name),
        species: animalCategory(classification),
        breed: cleanBreed(body.breed, animalCategory(classification)),
        gender,
        birthDate: new Date(birthDate),
        isCastrated,
        acquisitionType,
        status: String(status),
        gta: gta ? String(gta) : null,
        observations: observations ? String(observations) : null,
        imageUrl: imageUrl ? String(imageUrl) : null,
        motherId: motherId ? String(motherId) : null,
        customCode: cleanCustomCode(body.customCode),
      },
    })
    if (animal.motherId) await closeOpenPregnancy(animal.motherId, animal.id, animal.birthDate)
    return { animal }
  } catch (error: unknown) {
    const duplicate = duplicateCodeMessage(error)
    if (duplicate) return { error: duplicate, status: 409 }
    return { error: 'Erro ao criar animal', status: 500 }
  }
}
