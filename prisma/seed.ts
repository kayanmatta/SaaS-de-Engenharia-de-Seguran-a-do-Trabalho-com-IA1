import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

// 1. Carrega as variáveis de ambiente
dotenv.config()

// 2. Cria a conexão direta com o Supabase usando o driver do Postgres
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// 3. Cria o adaptador do Prisma
const adapter = new PrismaPg(pool)

// 4. Passa o adaptador no construtor (Exatamente o que o Prisma 7 exige!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const novaEmpresa = await prisma.company.create({
    data: {
      name: "Morelli Engenharia de Segurança",
      users: {
        create: {
          email: "contato@morelli.com",
          password: "senha_provisoria_123",
        }
      }
    }
  })
  console.log("✅ Sucesso! Empresa criada:", novaEmpresa)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Erro no seed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })