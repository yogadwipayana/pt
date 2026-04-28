import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaNeon } from '@prisma/adapter-neon'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('./generated/prisma/index.js')

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL || "",
})

export const prisma = new PrismaClient({ adapter })
