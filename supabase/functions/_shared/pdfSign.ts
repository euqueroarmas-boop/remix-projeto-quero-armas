/**
 * PDF Digital Signature Module — PAdES / ICP-Brasil Compatible
 *
 * Uses @signpdf ecosystem (signpdf + signer-p12 + placeholder-pdf-lib)
 * for standards-compliant CMS/PKCS#7 signatures embedded in the PDF.
 *
 * Compatible with:
 *  - validar.iti.gov.br (PAdES / CAdES-detached)
 *  - Adobe Acrobat Reader signature panel
 *  - Foxit, Okular, and other PDF readers
 */

import { SignPdf } from "npm:@signpdf/signpdf@3.3.0";
import { P12Signer } from "npm:@signpdf/signer-p12@3.3.0";
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.3.0";
import {
  SUBFILTER_ETSI_CADES_DETACHED,
  SUBFILTER_ADOBE_PKCS7_DETACHED,
} from "npm:@signpdf/utils@3.3.0";

export interface SignPdfOptions {
  reason?: string;
  location?: string;
  contactInfo?: string;
  signerName?: string;
  signingTime?: Date;
  /** Use CAdES-detached (PAdES) subfilter for ICP-Brasil. Default: true */
  usePades?: boolean;
}

export interface LateralMarkOptions {
  signerName: string;
  documentHash: string;
  signingDate?: string;
}

export interface SignResult {
  signedPdf: Uint8Array;
  signedPdfSize: number;
}

/**
 * Adds a visual stamp to the last page of a pdf-lib document.
 * Call BEFORE addPlaceholderAndSign().
 */
export function addVisualStamp(
  pdfDoc: any,
  pdfLib: any,
  lastPage: any,
  signerName: string,
  issuerCN: string,
  serialNumber: string,
): void {
  const { rgb } = pdfLib;
  // We need fonts — caller should pass them or we embed here
  // For simplicity, we draw with whatever fonts are available
  const { width: pageWidth } = lastPage.getSize();
  const stampX = 42;
  const stampY = 40;
  const stampWidth = pageWidth - 84;
  const stampHeight = 70;
  const sigDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  lastPage.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampWidth,
    height: stampHeight,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.7, 0.7, 0.75),
    borderWidth: 0.5,
  });

  // Note: caller should embed fonts and pass them if needed for text
  // The visual stamp text is drawn by the caller (sign-contract-pdf / test-certificate-sign)
  // This function only draws the background rectangle.
  // Text drawing is left to the caller for font flexibility.
}

/**
 * Complete flow: add placeholder to pdf-lib doc, save, sign with P12.
 *
 * @param pdfDoc - A pdf-lib PDFDocument (already with visual content)
 * @param pfxBytes - Raw .pfx/.p12 certificate bytes (decrypted)
 * @param password - Certificate password
 * @param opts - Signature metadata
 * @returns Signed PDF bytes
 */
export async function addPlaceholderAndSign(
  pdfDoc: any,
  pfxBytes: Uint8Array,
  password: string,
  opts: SignPdfOptions = {},
): Promise<SignResult> {
  const usePades = opts.usePades !== false;

  // 1. Add signature placeholder using @signpdf/placeholder-pdf-lib
  console.log("[pdfSign] Adding signature placeholder...");
  pdflibAddPlaceholder({
    pdfDoc,
    reason: opts.reason || "Assinatura digital do contrato",
    contactInfo: opts.contactInfo || "contato@wmti.com.br",
    name: opts.signerName || "WMTI Tecnologia",
    location: opts.location || "Brasil",
    signatureLength: 24000,
    ...(usePades ? { subFilter: SUBFILTER_ETSI_CADES_DETACHED } : {}),
  });

  // 2. Save PDF with placeholder (uncompressed for signature search)
  console.log("[pdfSign] Saving PDF with placeholder (useObjectStreams: false)...");
  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  // 3. Create P12 signer
  console.log("[pdfSign] Creating P12 signer...");
  const signer = new P12Signer(pfxBytes, { passphrase: password });

  // 4. Sign the PDF
  console.log("[pdfSign] Signing PDF with @signpdf...");
  const signPdf = new SignPdf();
  const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, signer);

  // Convert to Uint8Array if needed
  const signedPdf = signedPdfBuffer instanceof Uint8Array
    ? signedPdfBuffer
    : new Uint8Array(signedPdfBuffer);

  console.log(`[pdfSign] ✓ PDF signed successfully: ${signedPdf.length} bytes`);

  return {
    signedPdf,
    signedPdfSize: signedPdf.length,
  };
}

/**
 * Simplified helper: sign raw PDF bytes with a P12 certificate.
 * The PDF must already contain a signature placeholder.
 *
 * @param pdfBytes - PDF with placeholder already embedded
 * @param pfxBytes - Raw .pfx/.p12 certificate bytes
 * @param password - Certificate password
 * @returns Signed PDF bytes
 */
export async function signExistingPdf(
  pdfBytes: Uint8Array,
  pfxBytes: Uint8Array,
  password: string,
): Promise<SignResult> {
  const signer = new P12Signer(pfxBytes, { passphrase: password });
  const signPdf = new SignPdf();
  const signedPdfBuffer = await signPdf.sign(pdfBytes, signer);
  const signedPdf = signedPdfBuffer instanceof Uint8Array
    ? signedPdfBuffer
    : new Uint8Array(signedPdfBuffer);

  return { signedPdf, signedPdfSize: signedPdf.length };
}
