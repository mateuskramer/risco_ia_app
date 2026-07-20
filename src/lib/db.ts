import { Pool } from "pg";

// Em dev, o Next.js recarrega módulos a cada mudança de arquivo — sem isso,
// cada reload criaria um Pool novo e vazaria conexões. Guardamos o pool no
// objeto global pra reaproveitar entre reloads.
declare global {
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}
