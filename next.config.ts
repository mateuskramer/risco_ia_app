import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse usa pdf.js por baixo, que carrega um worker a partir de um
  // caminho de arquivo em runtime. Deixando o pacote fora do bundle do
  // Next.js (webpack/turbopack), ele roda como módulo Node normal e esse
  // caminho resolve certo — sem isso, dá "Setting up fake worker failed".
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
