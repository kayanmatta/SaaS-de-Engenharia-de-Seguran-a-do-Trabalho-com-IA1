'use server'

// Caminho exato: sobe 3 níveis (register -> (auth) -> app -> src) e entra em lib
import { prisma } from "../../../lib/prisma" 
import bcrypt from "bcrypt"

export async function registerAction(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { error: "Todos os campos são obrigatórios", success: false }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await prisma.company.create({
      data: {
        name,
        users: {
          create: {
            email,
            password: hashedPassword,
          }
        }
      }
    })
    return { error: null, success: true }
  } catch (e) {
    console.error(e)
    return { error: "Erro ao criar conta. E-mail já existe?", success: false }
  }
}