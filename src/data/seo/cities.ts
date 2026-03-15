export interface SeoCity {
  name: string;
  slug: string;
  state: string;
  region: string;
  priority: number;
}

export const cities: SeoCity[] = [
  // === Vale do Paraíba ===
  { name: "Jacareí", slug: "jacarei", state: "SP", region: "Vale do Paraíba", priority: 1.0 },
  { name: "São José dos Campos", slug: "sao-jose-dos-campos", state: "SP", region: "Vale do Paraíba", priority: 0.9 },
  { name: "Taubaté", slug: "taubate", state: "SP", region: "Vale do Paraíba", priority: 0.9 },
  { name: "Caçapava", slug: "cacapava", state: "SP", region: "Vale do Paraíba", priority: 0.7 },
  { name: "Pindamonhangaba", slug: "pindamonhangaba", state: "SP", region: "Vale do Paraíba", priority: 0.7 },
  { name: "Guaratinguetá", slug: "guaratingueta", state: "SP", region: "Vale do Paraíba", priority: 0.7 },
  { name: "Lorena", slug: "lorena", state: "SP", region: "Vale do Paraíba", priority: 0.6 },
  { name: "Cruzeiro", slug: "cruzeiro", state: "SP", region: "Vale do Paraíba", priority: 0.6 },

  // === Grande São Paulo ===
  { name: "São Paulo", slug: "sao-paulo", state: "SP", region: "Grande São Paulo", priority: 0.9 },
  { name: "Guarulhos", slug: "guarulhos", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "Osasco", slug: "osasco", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "Santo André", slug: "santo-andre", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "São Bernardo do Campo", slug: "sao-bernardo-do-campo", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "São Caetano do Sul", slug: "sao-caetano-do-sul", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Diadema", slug: "diadema", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Mauá", slug: "maua", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Mogi das Cruzes", slug: "mogi-das-cruzes", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "Suzano", slug: "suzano", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Taboão da Serra", slug: "taboao-da-serra", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Barueri", slug: "barueri", state: "SP", region: "Grande São Paulo", priority: 0.8 },
  { name: "Cotia", slug: "cotia", state: "SP", region: "Grande São Paulo", priority: 0.7 },
  { name: "Itaquaquecetuba", slug: "itaquaquecetuba", state: "SP", region: "Grande São Paulo", priority: 0.6 },

  // === Região de Campinas ===
  { name: "Campinas", slug: "campinas", state: "SP", region: "Região de Campinas", priority: 0.9 },
  { name: "Jundiaí", slug: "jundiai", state: "SP", region: "Região de Campinas", priority: 0.8 },
  { name: "Piracicaba", slug: "piracicaba", state: "SP", region: "Região de Campinas", priority: 0.8 },
  { name: "Americana", slug: "americana", state: "SP", region: "Região de Campinas", priority: 0.7 },
  { name: "Limeira", slug: "limeira", state: "SP", region: "Região de Campinas", priority: 0.7 },
  { name: "Indaiatuba", slug: "indaiatuba", state: "SP", region: "Região de Campinas", priority: 0.7 },
  { name: "Sumaré", slug: "sumare", state: "SP", region: "Região de Campinas", priority: 0.7 },
  { name: "Hortolândia", slug: "hortolandia", state: "SP", region: "Região de Campinas", priority: 0.6 },
  { name: "Valinhos", slug: "valinhos", state: "SP", region: "Região de Campinas", priority: 0.6 },
  { name: "Vinhedo", slug: "vinhedo", state: "SP", region: "Região de Campinas", priority: 0.6 },

  // === Litoral Paulista ===
  { name: "Santos", slug: "santos", state: "SP", region: "Litoral Paulista", priority: 0.8 },
  { name: "São Vicente", slug: "sao-vicente", state: "SP", region: "Litoral Paulista", priority: 0.6 },
  { name: "Praia Grande", slug: "praia-grande", state: "SP", region: "Litoral Paulista", priority: 0.6 },

  // === Sorocaba ===
  { name: "Sorocaba", slug: "sorocaba", state: "SP", region: "Região de Sorocaba", priority: 0.8 },
  { name: "Itu", slug: "itu", state: "SP", region: "Região de Sorocaba", priority: 0.7 },
  { name: "Salto", slug: "salto", state: "SP", region: "Região de Sorocaba", priority: 0.6 },

  // === Interior Noroeste ===
  { name: "Ribeirão Preto", slug: "ribeirao-preto", state: "SP", region: "Interior Noroeste", priority: 0.8 },
  { name: "São José do Rio Preto", slug: "sao-jose-do-rio-preto", state: "SP", region: "Interior Noroeste", priority: 0.8 },
  { name: "Barretos", slug: "barretos", state: "SP", region: "Interior Noroeste", priority: 0.7 },
  { name: "Araraquara", slug: "araraquara", state: "SP", region: "Interior Noroeste", priority: 0.7 },
  { name: "Franca", slug: "franca", state: "SP", region: "Interior Noroeste", priority: 0.7 },
  { name: "Sertãozinho", slug: "sertaozinho", state: "SP", region: "Interior Noroeste", priority: 0.6 },

  // === Interior Centro ===
  { name: "Bauru", slug: "bauru", state: "SP", region: "Interior Centro", priority: 0.7 },
  { name: "Marília", slug: "marilia", state: "SP", region: "Interior Centro", priority: 0.7 },
  { name: "Botucatu", slug: "botucatu", state: "SP", region: "Interior Centro", priority: 0.7 },
  { name: "Jaú", slug: "jau", state: "SP", region: "Interior Centro", priority: 0.6 },

  // === Interior Oeste ===
  { name: "Presidente Prudente", slug: "presidente-prudente", state: "SP", region: "Interior Oeste", priority: 0.7 },
  { name: "Araçatuba", slug: "aracatuba", state: "SP", region: "Interior Oeste", priority: 0.7 },
];
