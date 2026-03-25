/**
 * SEO DATA — SINGLE SOURCE FOR EDGE FUNCTIONS
 * =============================================
 * This file mirrors the slug data from:
 *   - src/data/seo/cities.ts
 *   - src/data/seo/services.ts
 *   - src/data/seo/segments.ts
 *   - src/data/seo/problems.ts
 *   - src/data/blogPosts.ts
 *
 * IMPORTANT: When you add a new city, service, segment, problem or blog post
 * in the frontend source files, add the slug here as well so the sitemap
 * stays in sync automatically.
 */

// ─── SERVICES (from src/data/seo/services.ts) ───
export const serviceSlugs: string[] = [
  "infraestrutura-ti",
  "suporte-ti",
  "monitoramento-rede",
  "servidores-dell",
  "microsoft-365",
  "seguranca-rede",
  "locacao-computadores",
  "administracao-servidores",
  "monitoramento-servidores",
  "backup-corporativo",
  "firewall-corporativo",
  "infraestrutura-rede",
  "suporte-emergencial",
  "suporte-windows-server",
  "suporte-linux",
  "manutencao-ti",
  "suporte-redes-corporativas",
  "terceirizacao-ti",
  "automacao-ia",
  "automacao-alexa",
  "reestruturacao-rede",
  "desenvolvimento-web",
];

// ─── SEGMENTS (from src/data/seo/segments.ts) ───
export interface SegmentEntry {
  slug: string;
  prefix: string; // URL prefix used in programmatic pages
}
export const segmentEntries: SegmentEntry[] = [
  { slug: "serventias-notariais", prefix: "ti-para-serventias-notariais" },
  { slug: "hospitais", prefix: "ti-para-hospitais" },
  { slug: "escritorios-advocacia", prefix: "ti-para-escritorios-de-advocacia" },
  { slug: "contabilidade", prefix: "ti-para-contabilidades" },
  { slug: "industrias-alimenticias", prefix: "ti-para-industrias-alimenticias" },
  { slug: "industrias-petroliferas", prefix: "ti-para-industrias-petroliferas" },
  { slug: "empresas-corporativas", prefix: "ti-para-empresas-corporativas" },
];

// ─── PROBLEMS (from src/data/seo/problems.ts) ───
export const problemSlugs: string[] = [
  "rede-lenta",
  "servidor-travando",
  "sem-backup",
  "ataque-ransomware",
  "computadores-lentos",
  "servidor-lento-empresa",
  "rede-corporativa-instavel",
  "empresa-sem-backup",
  "empresa-sem-firewall",
  "empresa-com-virus",
  "empresa-sem-monitoramento-ti",
  "empresa-com-servidor-antigo",
  "empresa-com-problemas-ti",
  "suporte-ti-urgente",
  "empresa-precisa-suporte-ti",
  "empresa-com-problema-rede",
  "empresa-com-servidor-caindo",
  "empresa-com-sistema-lento",
  "empresa-sem-infraestrutura-ti",
];

// ─── BLOG POST SLUGS (from src/data/blogPosts.ts) ───
export const blogSlugs: string[] = [
  "provimento-213-cnj-desafios-tecnologia-cartorios",
  "vantagens-microsoft-365-para-empresas",
  "quando-trocar-servidor-da-empresa",
  "ransomware-em-hospitais-como-proteger",
  "vazamento-dados-clinicas-medicas-lgpd",
  "backup-para-cartorios-estrategias-seguras",
  "firewall-pfsense-para-empresas-protecao-completa",
  "ataques-ciberneticos-escritorios-advocacia",
  "servidores-dell-poweredge-seguranca-dados",
  "lgpd-para-clinicas-e-hospitais-guia-pratico",
  "como-ransomware-ataca-cartorios",
  "falhas-infraestrutura-ti-hospitais",
  "backup-automatizado-clinicas-medicas",
  "segmentacao-rede-hospitalar-seguranca",
  "phishing-em-escritorios-advocacia-como-evitar",
  "redundancia-internet-clinicas-hospitais",
  "ransomware-wannacry-licoes-para-empresas",
  "vpn-segura-para-escritorios-advocacia",
  "como-proteger-prontuario-eletronico",
  "servidor-dedicado-vs-nuvem-para-empresas",
  "politica-seguranca-informacao-empresas",
  "backup-3-2-1-estrategia-para-empresas",
  "monitoramento-rede-prevencao-ataques",
  "lgpd-para-cartorios-adequacao-necessaria",
  "ataques-ddos-como-proteger-empresa",
  "ransomware-como-servico-ameaca-crescente",
  "recuperacao-desastres-ti-plano-pratico",
  "seguranca-email-corporativo-ameacas-comuns",
  "virtualizacao-servidores-seguranca-performance",
  "ciberseguranca-para-pequenas-empresas",
  "auditoria-seguranca-ti-por-que-fazer",
  "criptografia-dados-empresariais-guia",
  "equipamentos-medicos-conectados-riscos-seguranca",
  "guia-completo-infraestrutura-ti-empresas",
  "firewall-empresarial-sua-empresa-precisa",
  "servidor-caiu-empresa-o-que-fazer",
  "quanto-custa-infraestrutura-ti-empresas",
  "infraestrutura-ti-empresas-jacarei",
  "como-estabilizamos-rede-escritorio-25-computadores",
];

// ─── SERVICE ALIASES (long dedicated-page slugs) ───
export const serviceAliases: Record<string, string> = {
  "automacao-alexa-casa-empresa-inteligente": "automacao-alexa",
  "automacao-de-ti-com-inteligencia-artificial": "automacao-ia",
};

// ─── CITIES (from src/data/seo/cities.ts — 665 municípios de SP) ───
// Auto-synced with IBGE official list for São Paulo state
export const citySlugs: string[] = [
  // Vale do Paraíba
  "jacarei","sao-jose-dos-campos","taubate","cacapava","pindamonhangaba",
  "guaratingueta","lorena","cruzeiro","aparecida","cachoeira-paulista",
  "campos-do-jordao","caraguatatuba","cunha","igarata","ilhabela",
  "jambeiro","lagoinha","lavrinhas","monteiro-lobato","natividade-da-serra",
  "paraibuna","potim","queluz","redencao-da-serra","roseira",
  "santa-branca","santo-antonio-do-pinhal","sao-bento-do-sapucai","sao-luiz-do-paraitinga","sao-sebastiao",
  "silveiras","tremembe","ubatuba","arapei","areias","bananal","canas","piquete","sao-jose-do-barreiro",
  // Grande São Paulo
  "sao-paulo","guarulhos","osasco","santo-andre","sao-bernardo-do-campo",
  "sao-caetano-do-sul","diadema","maua","mogi-das-cruzes","suzano",
  "taboao-da-serra","barueri","cotia","itaquaquecetuba","carapicuiba",
  "itapevi","embu-das-artes","embu-guacu","ferraz-de-vasconcelos","francisco-morato",
  "franco-da-rocha","itapecerica-da-serra","jandira","mairipora","poa",
  "ribeirao-pires","rio-grande-da-serra","santana-de-parnaiba","aruja","biritiba-mirim",
  "caieiras","cajamar","guararema","juquitiba","pirapora-do-bom-jesus",
  "salesopolis","sao-lourenco-da-serra","vargem-grande-paulista","santa-isabel",
  // Região de Campinas
  "campinas","jundiai","piracicaba","americana","limeira",
  "indaiatuba","sumare","hortolandia","valinhos","vinhedo",
  "santa-barbara-doeste","santa-barbara-d-oeste","itatiba","nova-odessa","paulinia","cosmopolis",
  "artur-nogueira","engenheiro-coelho","holambra","jaguariuna","monte-mor",
  "pedreira","morungaba","louveira","amparo","serra-negra",
  "aguas-de-lindoia","lindoia","monte-alegre-do-sul","pinhalzinho","socorro",
  "rio-claro","araras","leme","mogi-guacu","mogi-mirim",
  "itapira","conchal","estiva-gerbi","cordeiropolis","ipeuna",
  "iracemapolis","santa-gertrudes","charqueada","saltinho","sao-pedro",
  "aguas-de-sao-pedro","santa-maria-da-serra","capivari","elias-fausto","rafard",
  "rio-das-pedras","mombuca","aguas-da-prata","caconde","santo-antonio-de-posse",
  "santo-antonio-do-jardim","sao-sebastiao-da-grama","tapiratiba","santa-cruz-da-conceicao",
  // Litoral Paulista
  "santos","sao-vicente","praia-grande","guaruja","cubatao",
  "bertioga","mongagua","itanhaem","peruibe","registro",
  "iguape","cananeia","ilha-comprida","cajati","jacupiranga",
  "eldorado","pariquera-acu","juquia","miracatu","pedro-de-toledo",
  "sete-barras","tapirai","iporanga","barra-do-turvo","itariri",
  // Região de Sorocaba
  "sorocaba","itu","salto","votorantim","aracoiaba-da-serra",
  "boituva","cerquilho","tatui","tiete","porto-feliz",
  "piedade","sao-roque","mairinque","aluminio","aracariguama",
  "capela-do-alto","cesario-lange","ibiuna","ipero","jumirim",
  "laranjal-paulista","pereiras","porangaba","quadra","salto-de-pirapora",
  "sarapui","sao-miguel-arcanjo","pilar-do-sul","alambari","torre-de-pedra","guarei",
  // Região de Ribeirão Preto
  "ribeirao-preto","franca","sertaozinho","araraquara","sao-carlos",
  "jaboticabal","bebedouro","batatais","cravinhos","brodowski",
  "jardinopolis","pontal","barrinha","pitangueiras","taquaritinga",
  "monte-azul-paulista","viradouro","orlandia","sao-joaquim-da-barra","ituverava",
  "patrocinio-paulista","pedregulho","igarapava","guara","miguelopolis",
  "morro-agudo","nuporanga","sales-oliveira","descalvado","ibate",
  "porto-ferreira","santa-rita-do-passa-quatro","matao","ibitinga","itapolis",
  "americo-brasiliense","santa-lucia","rincao","gaviao-peixoto","motuca",
  "colombia","guaira","ipua","jaborandi","pirangi","serrana","taquaral",
  "santa-cruz-da-esperanca",
  // Região de São José do Rio Preto
  "sao-jose-do-rio-preto","barretos","catanduva","votuporanga","fernandopolis",
  "mirassol","olimpia","tanabi","novo-horizonte","jose-bonifacio",
  "monte-aprazivel","jales","santa-fe-do-sul","ilha-solteira","pereira-barreto",
  "colina","guapiacu","potirendaba","bady-bassitt","cedral",
  "uchoa","tabapua","novais","palmares-paulista",
  "adolfo","aparecida-d-oeste","aspasia","balsamo","dirce-reis",
  "estrela-d-oeste","guarani-d-oeste","guzolandia","ipigua","macedonia",
  "marinopolis","mesopolis","mirassolandia","nova-alianca","nova-canaa-paulista",
  "nova-castilho","nova-granada","nova-luzitania","onda-verde","palestina",
  "palmeira-d-oeste","paranapua","pindorama","pontalinda","rubineia",
  "santa-albertina","santa-clara-d-oeste","santa-rita-d-oeste","santa-salete",
  "santana-da-ponte-pensa","sao-joao-das-duas-pontes","sao-joao-de-iracema","urupes",
  // Região de Bauru
  "bauru","marilia","botucatu","jau","lins",
  "avare","garca","tupa","ourinhos","assis",
  "pederneiras","bariri","barra-bonita","dois-corregos","brotas",
  "igaracu-do-tiete","mineiros-do-tiete","bocaina","agudos","arealva",
  "cabralia-paulista","duartina","piratininga","lencois-paulista","sao-manuel",
  "macatuba","areiopolis","itatinga","pardinho","bofete",
  "anhembi","conchas","promissao","penapolis","getulina",
  "guaicara","cafelandia","pompeia","vera-cruz","echapora",
  "oriente","oscar-bressane","ocaucu","alvaro-de-carvalho","paraguacu-paulista",
  "candido-mota","palmital","chavantes","santa-cruz-do-rio-pardo","piraju",
  "bernardino-de-campos","ipaussu","cerqueira-cesar","manduri","itai",
  "taguai","itaporanga","itapetininga","itapeva","capao-bonito",
  "angatuba","apiai","buri","guapiara","ribeirao-branco",
  "ribeira","riversul","taquarivai",
  "balbinos","boraceia","borebi","guaimbe","iacanga","itaju","itapui",
  "julio-mesquita","lucianopolis","paranapanema","paulistania","pratania",
  "presidente-alves","ubirajara","uru",
  // Região Oeste / Presidente Prudente
  "presidente-prudente","aracatuba","presidente-venceslau","presidente-epitacio","adamantina",
  "dracena","lucelia","osvaldo-cruz","martinopolis","rancharia",
  "regente-feijo","alvares-machado","birigui","andradina",
  "valparaiso","castilho","mirandopolis","guararapes","buritama",
  "coroados","gabriel-monteiro","glicerio","clementina",
  "santo-antonio-do-aracangua","auriflama","general-salgado","gastao-vidigal","nhandeara",
  "panorama","ouro-verde","pauliceia","ribeirao-dos-indios","rosana",
  "santa-mercedes","santo-expedito","teodoro-sampaio","tupi-paulista",
  "flora-rica","florida-paulista","inubia-paulista","mariapolis","monte-castelo",
  "alfredo-marcondes","caiua","euclides-da-cunha-paulista","irapuru","maraba-paulista",
  "nova-guataporanga","piquerobi","sao-joao-do-pau-d-alho","santo-anastacio",
  // Região de Araçatuba
  "bento-de-abreu","brejo-alegre","guaracai","itapura","lavinia",
  "murutinga-do-sul","nova-independencia","sud-mennucci","suzanapolis",
  // Sudoeste Paulista
  "itarare","taquarituba","fartura","sao-pedro-do-turvo","tejupa",
  "sarutaia","barao-de-antonina","coronel-macedo","itabera","nova-campina",
  "barra-do-chapeu","campina-do-monte-alegre","itapirapua-paulista","ribeirao-grande",
  "alambari",
  // Interior Centro-Leste
  "sao-joao-da-boa-vista","mococa","casa-branca","tambau","sao-jose-do-rio-pardo",
  "espirito-santo-do-pinhal","aguai","vargem-grande-do-sul","divinolandia","itobi",
  "santa-cruz-das-palmeiras","pirassununga","analandia","corumbatai","itirapina",
  // Região de Franca
  "restinga","cristais-paulista","ribeirao-corrente","buritizal","aramina",
  "jeriquara","rifaina","sao-jose-da-bela-vista","itirapua",
  // Centro-Oeste Paulista
  "avai","pirajui","reginopolis","guaranta",
  "pongai","sabino","avanhandava","barbosa","brauna",
  "luiziania","bilac","rubiacea","santopolis-do-aguapei","piacatu",
  "turiuba","alto-alegre","lourdes",
  // Alta Paulista
  "rinopolis","herculandia","quintana","iacri","bastos",
  "queiroz","arco-iris","parapua","pracinha","sagres","salmourao",
  // Região de Marília extras
  "taruma","lutecia","platina","maracai","cruzalia","florinea","pedrinhas-paulista",
  "alvinlandia","fernao","galia","lupercio","campos-novos-paulista",
  "espirito-santo-do-turvo","ibirarema","ribeirao-do-sul","salto-grande",
  // Noroeste Paulista
  "cardoso","meridiano","ouroeste","populina",
  "pontes-gestal","riolandia","sao-francisco","turmalina","valentim-gentil",
  "dolcinopolis","indiapora","mira-estrela","parisi",
  "paulo-de-faria","pedranopolis","sebastianopolis-do-sul","tres-fronteiras","urania",
  "vitoria-brasil","alvares-florence","americo-de-campos","cosmorama","floreal",
  "magda","neves-paulista","macaubal","moncoes","poloni",
  "ubarana","uniao-paulista","zacarias","mendonca","planalto",
  "nipoa","ibira","catigua","elisiario","embauba",
  "irapua","itajobi","marapoama","sales","severinia",
  "ariranha","cajobi","paraiso","vista-alegre-do-alto",
  "terra-roxa","altair","guaraci","icem","orindiuva","jaci",
  // Região de Assis extras
  "quata","bora","joao-ramalho",
  "nantes","narandiba","sandovalina","taciba","tarabai",
  "emilianopolis","caiabu","anhumas",
  // Complemento diversas regiões
  "timburi","oleo","canitar","aguas-de-santa-barbara","iaras","arandu",
  "torrinha","dourado","ribeirao-bonito","trabiju","boa-esperanca-do-sul",
  "tabatinga","nova-europa","borborema","fernando-prestes","candido-rodrigues",
  "santa-adelia","santa-ernestina","monte-alto","taiacu",
  "taiuva","guariba","pradopolis","guatapara","dumont",
  "santa-rosa-de-viterbo","cajuru","cassia-dos-coqueiros","altinopolis",
  "santo-antonio-da-alegria","serra-azul","luis-antonio","sao-simao","dobrada",
];
