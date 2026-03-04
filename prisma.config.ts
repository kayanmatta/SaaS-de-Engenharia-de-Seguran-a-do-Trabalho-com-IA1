import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    // Adicionamos o 'npx' antes do 'tsx' para o Windows encontrá-lo
    seed: 'npx tsx ./prisma/seed.ts',
  },
});