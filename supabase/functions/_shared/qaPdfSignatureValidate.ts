// Shared PDF signature validation (PAdES/PKCS#7) used by Quero Armas.
// Estrutural: extrai blobs /Contents <hex> e parseia PKCS#7 com node-forge.
// Não faz revogação/CRL/OCSP — para isso, o cliente é direcionado ao validador
// oficial do ITI. Suficiente para classificar valid / invalid / indeterminate.
import forge from "https://esm.sh/node-forge@1.3.1";

export type SignatureMeta = {
  valida: boolean;
  status: "valida" | "invalida" | "sem_assinatura" | "erro";
  signatario: string | null;
  cpf_signatario: string | null;
  data_assinatura: string | null;
  autoridade: string | null;
  icp_brasil: boolean;
  total_assinaturas: number;
  motivo_falha?: string;
};

const ICP_HINTS = [
  "ICP-Brasil","AC Raiz Brasileira","AC SERASA","AC SAFEWEB","AC SOLUTI","AC VALID",
  "AC CERTISIGN","AC SERPRO","AC CAIXA","AC BR RFB","AC RFB","AC IMESP","AC PRODEMGE",
  "AC DIGITAL","AC GOVBR","Gov.br",
];

function extractBlobs(pdf: Uint8Array): Uint8Array[] {
  const text = new TextDecoder("latin1").decode(pdf);
  const blobs: Uint8Array[] = [];
  const re = /\/Contents\s*<([0-9A-Fa-f\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const hex = m[1].replace(/\s+/g, "").replace(/(00)+$/i, "");
    if (hex.length < 16 || hex.length % 2) continue;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    blobs.push(out);
  }
  return blobs;
}

function isIcp(cn: string | null): boolean {
  if (!cn) return false;
  const l = cn.toLowerCase();
  return ICP_HINTS.some((h) => l.includes(h.toLowerCase()));
}

export function validatePdfSignature(pdfBytes: Uint8Array): SignatureMeta {
  const head = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (!head.startsWith("%PDF")) {
    return {
      valida: false, status: "sem_assinatura",
      signatario: null, cpf_signatario: null, data_assinatura: null,
      autoridade: null, icp_brasil: false, total_assinaturas: 0,
      motivo_falha: "Arquivo enviado não é um PDF.",
    };
  }
  const blobs = extractBlobs(pdfBytes);
  if (!blobs.length) {
    return {
      valida: false, status: "sem_assinatura",
      signatario: null, cpf_signatario: null, data_assinatura: null,
      autoridade: null, icp_brasil: false, total_assinaturas: 0,
      motivo_falha: "PDF não contém assinatura digital embutida (PAdES/PKCS#7).",
    };
  }
  for (const blob of blobs) {
    try {
      const der = forge.util.createBuffer(
        Array.from(blob).map((b) => String.fromCharCode(b)).join(""),
      );
      const asn1 = forge.asn1.fromDer(der);
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as any;
      const certs = p7.certificates || [];
      if (!certs.length) continue;
      const signer = certs[0];
      const subj = signer.subject.attributes as Array<any>;
      const iss = signer.issuer.attributes as Array<any>;
      const cn = subj.find((a) => a.shortName === "CN")?.value as string | undefined;
      let nome: string | null = cn || null;
      let cpf: string | null = null;
      if (nome) {
        const m = nome.match(/(\d{11})/);
        if (m) cpf = m[1];
        nome = nome.replace(/:\d{11}.*$/, "").trim();
      }
      const issuerCN = iss.find((a) => a.shortName === "CN")?.value || null;
      let signingTime: string | null = null;
      try {
        const signers = (p7 as any).rawCapture?.signerInfos || [];
        for (const si of signers) {
          const authAttrs = si.value?.[3]?.value || [];
          for (const attr of authAttrs) {
            const oid = forge.asn1.derToOid(attr.value[0].value);
            if (oid === "1.2.840.113549.1.9.5") {
              const t = attr.value[1].value[0].value;
              const d = forge.asn1.utcTimeToDate(t);
              if (d) signingTime = d.toISOString();
              break;
            }
          }
          if (signingTime) break;
        }
      } catch { /* ignore */ }
      return {
        valida: true, status: "valida",
        signatario: nome, cpf_signatario: cpf,
        data_assinatura: signingTime, autoridade: issuerCN,
        icp_brasil: isIcp(issuerCN), total_assinaturas: blobs.length,
      };
    } catch { continue; }
  }
  return {
    valida: false, status: "invalida",
    signatario: null, cpf_signatario: null, data_assinatura: null,
    autoridade: null, icp_brasil: false, total_assinaturas: blobs.length,
    motivo_falha: "Nenhuma das assinaturas embutidas pôde ser interpretada.",
  };
}

export function normalizeCpf(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}