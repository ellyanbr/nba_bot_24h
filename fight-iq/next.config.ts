import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A importação aceita CSV de até 2 MB (validado no navegador e no servidor).
      // O limite padrão do Next é 1 MB; 3 MB cobre o arquivo + o restante do formulário.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
