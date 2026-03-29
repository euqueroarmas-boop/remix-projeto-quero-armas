/**
 * Mapa de objetos contratuais por slug de serviço.
 * Cada entrada descreve o escopo específico do serviço para injeção na cláusula 1.2 do contrato.
 * 
 * REGRA: O contrato deve refletir SOMENTE o serviço contratado.
 * NÃO incluir lista genérica, outros serviços ou escopo aberto.
 */

export const SERVICE_CONTRACT_OBJECTS: Record<string, string> = {
  "administracao-de-servidores":
    `A CONTRATADA prestará serviços contínuos de administração de servidores, compreendendo a gestão, monitoramento, manutenção preventiva e corretiva dos servidores contratados pela CONTRATANTE, físicos e/ou virtuais.

O serviço poderá abranger administração de sistemas operacionais Windows Server e/ou Linux, gerenciamento de usuários, permissões e políticas de acesso, monitoramento de desempenho e disponibilidade.

O escopo limita-se exclusivamente aos servidores informados no momento da contratação, não abrangendo outros ativos ou serviços não contratados.`,

  "monitoramento-de-rede":
    `A CONTRATADA prestará serviços contínuos de monitoramento de rede, compreendendo o acompanhamento proativo da infraestrutura de rede da CONTRATANTE, incluindo switches, roteadores, firewalls, links de internet e demais ativos de rede.

O serviço abrange alertas de indisponibilidade, análise de desempenho, relatórios periódicos e suporte remoto para incidentes de rede.

O escopo limita-se exclusivamente aos ativos de rede informados no momento da contratação, não abrangendo outros equipamentos ou serviços não contratados.`,

  "backup-corporativo":
    `A CONTRATADA prestará serviços contínuos de backup corporativo, compreendendo a configuração, monitoramento e verificação periódica das rotinas de backup dos dados da CONTRATANTE.

O serviço poderá abranger backup local, backup em nuvem, testes de restauração e relatórios de integridade dos dados.

O escopo limita-se exclusivamente aos ambientes e dados informados no momento da contratação, não abrangendo outros sistemas ou serviços não contratados.`,

  "infraestrutura-de-ti":
    `A CONTRATADA prestará serviços contínuos de gestão de infraestrutura de TI, compreendendo a manutenção preventiva e corretiva dos ativos de tecnologia da informação da CONTRATANTE.

O serviço poderá abranger estações de trabalho, servidores, ativos de rede, cabeamento estruturado e periféricos corporativos.

O escopo limita-se exclusivamente aos ativos informados no momento da contratação, não abrangendo aquisições, projetos de implantação ou serviços não contratados.`,

  "suporte-de-ti":
    `A CONTRATADA prestará serviços contínuos de suporte técnico de TI, compreendendo o atendimento remoto e/ou presencial para resolução de incidentes e dúvidas técnicas dos colaboradores da CONTRATANTE.

O serviço poderá abranger suporte a estações de trabalho, impressoras, e-mail corporativo, softwares e sistemas operacionais.

O escopo limita-se exclusivamente ao suporte técnico operacional, não abrangendo projetos, implantações, migrações ou serviços não contratados.`,

  "seguranca-de-rede":
    `A CONTRATADA prestará serviços contínuos de segurança de rede, compreendendo a configuração, monitoramento e manutenção de firewalls, políticas de segurança e proteção contra ameaças cibernéticas.

O serviço poderá abranger gestão de firewall, VPN, antivírus corporativo, políticas de acesso e análise de vulnerabilidades.

O escopo limita-se exclusivamente aos ativos e perímetros de segurança informados no momento da contratação, não abrangendo outros serviços não contratados.`,

  "terceirizacao-de-ti":
    `A CONTRATADA prestará serviços contínuos de terceirização de TI, assumindo a gestão completa do ambiente tecnológico da CONTRATANTE conforme escopo definido no momento da contratação.

O serviço poderá abranger suporte técnico, gestão de infraestrutura, monitoramento, backup e segurança, conforme pacote contratado.

O escopo limita-se exclusivamente aos serviços expressamente definidos no momento da contratação, não abrangendo demandas extraordinárias ou serviços não previstos.`,
};

/**
 * Retorna o objeto contratual específico para um slug de serviço.
 * Se o slug não for encontrado, retorna um texto genérico seguro.
 */
export function getServiceContractObject(serviceSlug: string): string {
  const obj = SERVICE_CONTRACT_OBJECTS[serviceSlug];
  if (obj) return obj;

  // Fallback seguro — nunca deixar o campo vazio
  return `Os serviços de T.I. objeto deste contrato serão aqueles especificamente definidos no momento da contratação, conforme escopo acordado entre as partes. O escopo limita-se exclusivamente aos serviços expressamente contratados, não abrangendo demandas extraordinárias, projetos, implantações, migrações, aquisições de infraestrutura ou quaisquer serviços não expressamente previstos.`;
}
