/** @type {import('next').NextConfig} */
const nextConfig = {
  // Os fragmentos capturados em content/*.html são bem grandes (até ~1.9MB);
  // aumenta o limite para o Server Actions/route handlers não reclamarem
  // ao aceitar uploads (não usamos isso hoje, mas evita surpresa futura).
  experimental: {
    serverActions: { bodySizeLimit: '4mb' }
  }
};

export default nextConfig;
