import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof makePrismaClient> }

function makePrismaClient() {
  return new PrismaClient().$extends(withAccelerate())
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
