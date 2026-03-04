import { getServerSession } from "next-auth"
import { prisma } from "./prisma"

/**
 * Retorna os dados do tenant (empresa) do usuário logado.
 */
export async function getTenantSession() {
  const session = await getServerSession()
  if (!session?.user) return null

  return {
    userId:      (session.user as any).id          as string,
    companyId:   (session.user as any).companyId   as string,
    companyName: (session.user as any).companyName as string,
    role:        (session.user as any).role        as string,
  }
}

/**
 * Busca documentos APENAS da empresa do usuário logado.
 */
export async function getCompanyDocuments() {
  const tenant = await getTenantSession()
  if (!tenant) return []

  return prisma.document.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Busca usuários APENAS da empresa do usuário logado.
 * Só ADMIN/SUPERADMIN pode usar.
 */
export async function getCompanyUsers() {
  const tenant = await getTenantSession()
  if (!tenant) return []
  if (tenant.role !== "ADMIN" && tenant.role !== "SUPERADMIN") return []

  return prisma.user.findMany({
    where: { companyId: tenant.companyId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  })
}