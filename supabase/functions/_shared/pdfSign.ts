/**
 * PDF Digital Signature Module — ICP-Brasil A1 Compatible
 *
 * Embeds a PKCS#7/CMS detached signature directly into the PDF structure
 * using /SubFilter /adbe.pkcs7.detached with proper /ByteRange.
 *
 * Compatible with:
 *  - validar.iti.gov.br
 *  - Adobe Acrobat Reader signature panel
 *  - Foxit, Okular, and other PDF readers
 */

const SIGNATURE_MAX_LENGTH = 16384; // 16 KB for CMS DER

export interface SignPdfOptions {
  reason?: string;
  location?: string;
  contactInfo?: string;
  signerName?: string;
  signingTime?: Date;
}

/* ── helpers ─────────────────────────────────────────── */

function formatPdfDate(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function uint8ToLatin1(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return s;
}

function latin1ToUint8(str: string): Uint8Array {
  const a = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
  return a;
}

/* ── 1. Add signature placeholder ───────────────────── */

/**
 * Adds a PDF signature field with a placeholder /Contents to a pdf-lib document.
 * **Must be called BEFORE `pdfDoc.save({ useObjectStreams: false })`.**
 * IMPORTANT: You MUST pass `{ useObjectStreams: false }` to `pdfDoc.save()`
 * so the signature dictionary is written uncompressed and searchable.
 *
 * @param pdfDoc  - A pdf-lib PDFDocument instance
 * @param pdfLib  - The pdf-lib module (to access PDFName, PDFHexString, etc.)
 * @param lastPage - The pdf-lib PDFPage where the widget annotation is anchored
 */
export function addSignaturePlaceholder(
  pdfDoc: any,
  pdfLib: any,
  lastPage: any,
  signerName: string,
  opts: SignPdfOptions = {},
): void {
  const { PDFName, PDFHexString, PDFString, PDFNumber, PDFArray } = pdfLib;
  const ctx = pdfDoc.context;
  const now = opts.signingTime || new Date();

  /* Signature value dictionary (/Type /Sig) */
  const sigDict = ctx.obj({});
  sigDict.set(PDFName.of("Type"), PDFName.of("Sig"));
  sigDict.set(PDFName.of("Filter"), PDFName.of("Adobe.PPKLite"));
  sigDict.set(PDFName.of("SubFilter"), PDFName.of("adbe.pkcs7.detached"));

  // ByteRange with 10-digit placeholders — same length after replacement
  const br = PDFArray.withContext(ctx);
  br.push(PDFNumber.of(0));
  br.push(PDFNumber.of(9999999999));
  br.push(PDFNumber.of(9999999999));
  br.push(PDFNumber.of(9999999999));
  sigDict.set(PDFName.of("ByteRange"), br);

  // Contents placeholder (hex-encoded zeros)
  sigDict.set(
    PDFName.of("Contents"),
    PDFHexString.of("0".repeat(SIGNATURE_MAX_LENGTH * 2)),
  );

  sigDict.set(PDFName.of("Reason"), PDFString.of(opts.reason || "Assinatura digital do contrato"));
  sigDict.set(PDFName.of("Location"), PDFString.of(opts.location || "Brasil"));
  sigDict.set(PDFName.of("ContactInfo"), PDFString.of(opts.contactInfo || "contato@wmti.com.br"));
  sigDict.set(PDFName.of("Name"), PDFString.of(signerName));
  sigDict.set(PDFName.of("M"), PDFString.of(formatPdfDate(now)));

  const sigRef = ctx.register(sigDict);

  /* Widget annotation */
  const widget = ctx.obj({});
  widget.set(PDFName.of("Type"), PDFName.of("Annot"));
  widget.set(PDFName.of("Subtype"), PDFName.of("Widget"));
  widget.set(PDFName.of("FT"), PDFName.of("Sig"));
  widget.set(PDFName.of("Rect"), ctx.obj([0, 0, 0, 0])); // invisible
  widget.set(PDFName.of("V"), sigRef);
  widget.set(PDFName.of("T"), PDFString.of("Signature1"));
  widget.set(PDFName.of("F"), PDFNumber.of(4)); // Print flag
  widget.set(PDFName.of("P"), lastPage.ref);

  const widgetRef = ctx.register(widget);

  /* Add widget to page /Annots */
  const rawAnnots = lastPage.node.lookup(PDFName.of("Annots"));
  if (rawAnnots && typeof rawAnnots.push === "function") {
    rawAnnots.push(widgetRef);
  } else {
    lastPage.node.set(PDFName.of("Annots"), ctx.obj([widgetRef]));
  }

  /* AcroForm on catalog */
  const acroForm = ctx.obj({});
  acroForm.set(PDFName.of("SigFlags"), PDFNumber.of(3)); // SignaturesExist | AppendOnly
  acroForm.set(PDFName.of("Fields"), ctx.obj([widgetRef]));
  pdfDoc.catalog.set(PDFName.of("AcroForm"), acroForm);
}

/* ── 2. Embed the CMS signature ─────────────────────── */

/**
 * Finds the placeholder in the saved PDF bytes, calculates ByteRange,
 * creates a CMS/PKCS#7 detached signature, and embeds it.
 *
 * @returns The signed PDF bytes and the hex-encoded signature
 */
export async function signPdfBytes(
  pdfBytes: Uint8Array,
  forge: any,
  privateKey: any,
  certificate: any,
  additionalCerts: any[] = [],
): Promise<{ signedPdf: Uint8Array; signatureHex: string }> {
  const pdfStr = uint8ToLatin1(pdfBytes);

  /* 1 — locate Contents placeholder */
  const zeroHex = "0".repeat(SIGNATURE_MAX_LENGTH * 2);
  const contentsTag = `<${zeroHex}>`;
  const contentsIdx = pdfStr.indexOf(contentsTag);
  if (contentsIdx === -1) {
    throw new Error("Signature Contents placeholder not found in PDF");
  }
  const contentsEnd = contentsIdx + contentsTag.length;

  /* 2 — calculate ByteRange */
  const byteRange = [
    0,
    contentsIdx,
    contentsEnd,
    pdfBytes.length - contentsEnd,
  ];

  /* 3 — replace ByteRange placeholder (same byte length) */
  const brRegex =
    /\/ByteRange\s*\[\s*0\s+9999999999\s+9999999999\s+9999999999\s*\]/;
  const brMatch = pdfStr.match(brRegex);
  if (!brMatch || brMatch.index === undefined) {
    throw new Error("ByteRange placeholder not found in PDF");
  }

  const origBr = brMatch[0];
  let newBr = `/ByteRange [0 ${byteRange[1]} ${byteRange[2]} ${byteRange[3]}]`;
  newBr = newBr.padEnd(origBr.length, " ");

  if (newBr.length !== origBr.length) {
    throw new Error(
      `ByteRange length mismatch: got ${newBr.length}, need ${origBr.length}`,
    );
  }

  const updatedStr =
    pdfStr.substring(0, brMatch.index) +
    newBr +
    pdfStr.substring(brMatch.index + origBr.length);
  const updatedBytes = latin1ToUint8(updatedStr);

  /* 4 — extract data to sign (everything except Contents value) */
  const dataToSign = new Uint8Array(byteRange[1] + byteRange[3]);
  dataToSign.set(updatedBytes.subarray(0, byteRange[1]), 0);
  dataToSign.set(
    updatedBytes.subarray(byteRange[2], byteRange[2] + byteRange[3]),
    byteRange[1],
  );

  /* 5 — create CMS/PKCS#7 detached signature */
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(uint8ToLatin1(dataToSign));
  p7.addCertificate(certificate);
  for (const c of additionalCerts) {
    p7.addCertificate(c);
  }

  p7.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  p7.sign({ detached: true });

  const derStr = forge.asn1.toDer(p7.toAsn1()).getBytes();
  let sigHex = "";
  for (let i = 0; i < derStr.length; i++) {
    sigHex += derStr.charCodeAt(i).toString(16).padStart(2, "0");
  }

  if (sigHex.length > SIGNATURE_MAX_LENGTH * 2) {
    throw new Error(
      `CMS signature too large: ${sigHex.length / 2} bytes (max ${SIGNATURE_MAX_LENGTH})`,
    );
  }

  // Pad to fill the entire placeholder
  sigHex = sigHex.padEnd(SIGNATURE_MAX_LENGTH * 2, "0");

  /* 6 — insert signature hex into Contents placeholder */
  for (let i = 0; i < sigHex.length; i++) {
    updatedBytes[contentsIdx + 1 + i] = sigHex.charCodeAt(i);
  }

  return {
    signedPdf: updatedBytes,
    signatureHex: sigHex.replace(/0+$/, ""),
  };
}
