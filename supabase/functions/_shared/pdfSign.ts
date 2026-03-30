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
 *
 * IMPORTANT: The PDF MUST be saved with { useObjectStreams: false }
 * so the signature dictionary is written uncompressed and searchable.
 */

const SIGNATURE_MAX_LENGTH = 16384; // 16 KB for CMS DER

export interface SignPdfOptions {
  reason?: string;
  location?: string;
  contactInfo?: string;
  signerName?: string;
  signingTime?: Date;
}

export interface SignDiagnostics {
  byteRange: number[];
  pdfSize: number;
  placeholderSize: number;
  cmsSize: number;
  dataToSignHash: string;
  resignedAuthAttrs: boolean;
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

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── 1. Add signature placeholder ───────────────────── */

/**
 * Adds a PDF signature field with a placeholder /Contents to a pdf-lib document.
 * **Must be called BEFORE `pdfDoc.save({ useObjectStreams: false })`.**
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

/* ── 2. Re-sign authenticated attributes ────────────── */

/**
 * After forge's p7.sign(), the ASN.1 output may re-serialize the
 * authenticated attributes with a different DER encoding than what
 * was originally signed. This function re-signs using the EXACT
 * encoding that appears in the output, ensuring validators see a
 * matching RSA signature.
 */
function resignCmsAuthAttrs(asn1Root: any, forge: any, privateKey: any): boolean {
  try {
    // Navigate: ContentInfo → [0] → SignedData → signerInfos → signerInfo
    const signedDataWrapper = asn1Root.value[1]; // CONTEXT [0] EXPLICIT
    const signedData = signedDataWrapper.value[0]; // SEQUENCE (SignedData)

    // signerInfos is the last SET child of SignedData
    let signerInfosSet: any = null;
    for (let i = signedData.value.length - 1; i >= 0; i--) {
      const child = signedData.value[i];
      if (child.tagClass === forge.asn1.Class.UNIVERSAL &&
          child.type === forge.asn1.Type.SET &&
          child.constructed) {
        signerInfosSet = child;
        break;
      }
    }
    if (!signerInfosSet) throw new Error("signerInfos SET not found");

    const signerInfo = signerInfosSet.value[0]; // first SEQUENCE

    // Find authenticatedAttributes [0] IMPLICIT and encryptedDigest OCTET STRING
    let authAttrsNode: any = null;
    let encDigestNode: any = null;

    for (const child of signerInfo.value) {
      // authenticatedAttributes: CONTEXT_SPECIFIC, constructed, type 0
      if (child.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
          child.constructed && child.type === 0) {
        authAttrsNode = child;
      }
      // encryptedDigest: UNIVERSAL OCTET_STRING, not constructed
      if (child.tagClass === forge.asn1.Class.UNIVERSAL &&
          child.type === forge.asn1.Type.OCTETSTRING &&
          !child.constructed) {
        encDigestNode = child;
      }
    }

    if (!authAttrsNode || !encDigestNode) {
      throw new Error("authenticatedAttributes or encryptedDigest not found in SignerInfo");
    }

    // Create a copy with SET tag (0x31) for signing — per CMS spec,
    // the signature is computed over the DER encoding with UNIVERSAL SET tag,
    // not the IMPLICIT [0] tag used in the SignerInfo structure.
    const setForSigning = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      authAttrsNode.value, // same children
    );

    const attrsDer = forge.asn1.toDer(setForSigning).getBytes();

    // Hash with SHA-256
    const md = forge.md.sha256.create();
    md.update(attrsDer);

    // RSA sign (PKCS#1 v1.5 with SHA-256 DigestInfo)
    const sig = privateKey.sign(md);

    // Replace the encryptedDigest value
    encDigestNode.value = sig;

    console.log("[pdfSign] Re-signed authenticatedAttributes:",
      `attrs DER=${attrsDer.length} bytes, sig=${sig.length} bytes`);
    return true;
  } catch (e) {
    console.error("[pdfSign] resignCmsAuthAttrs failed:", e);
    return false;
  }
}

/* ── 3. Embed the CMS signature ─────────────────────── */

/**
 * Finds the placeholder in the saved PDF bytes, calculates ByteRange,
 * creates a CMS/PKCS#7 detached signature, re-signs the authenticated
 * attributes for exact DER match, and embeds the result.
 *
 * @returns The signed PDF bytes, hex signature, and diagnostics
 */
export async function signPdfBytes(
  pdfBytes: Uint8Array,
  forge: any,
  privateKey: any,
  certificate: any,
  additionalCerts: any[] = [],
): Promise<{ signedPdf: Uint8Array; signatureHex: string; diagnostics: SignDiagnostics }> {
  const pdfStr = uint8ToLatin1(pdfBytes);

  /* 1 — locate Contents placeholder */
  const zeroHex = "0".repeat(SIGNATURE_MAX_LENGTH * 2);
  const contentsTag = `<${zeroHex}>`;
  const contentsIdx = pdfStr.indexOf(contentsTag);
  if (contentsIdx === -1) {
    // Debug: show surrounding bytes where we'd expect it
    const sigIdx = pdfStr.indexOf("/Contents");
    const context = sigIdx >= 0
      ? pdfStr.substring(sigIdx, Math.min(sigIdx + 100, pdfStr.length))
      : "NOT_FOUND";
    throw new Error(
      `Signature Contents placeholder not found in PDF (size=${pdfBytes.length}). ` +
      `Near /Contents: ${context}`
    );
  }
  const contentsEnd = contentsIdx + contentsTag.length;

  /* 2 — calculate ByteRange */
  const byteRange = [
    0,
    contentsIdx,
    contentsEnd,
    pdfBytes.length - contentsEnd,
  ];

  console.log("[pdfSign] ByteRange:", JSON.stringify(byteRange),
    `| PDF size: ${pdfBytes.length} | Placeholder: ${contentsTag.length} bytes`);

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

  const dataHash = await sha256Hex(dataToSign);
  console.log("[pdfSign] Data to sign:", dataToSign.length, "bytes | SHA-256:", dataHash);

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

  /* 6 — get ASN.1, re-sign authenticated attributes with exact output encoding */
  const asn1 = p7.toAsn1();
  const resigned = resignCmsAuthAttrs(asn1, forge, privateKey);

  /* 7 — serialize the (re-signed) CMS to DER */
  const derBytes = forge.asn1.toDer(asn1).getBytes();

  let sigHex = "";
  for (let i = 0; i < derBytes.length; i++) {
    sigHex += (derBytes.charCodeAt(i) & 0xff).toString(16).padStart(2, "0").toUpperCase();
  }

  const cmsSize = derBytes.length;
  console.log("[pdfSign] CMS DER:", cmsSize, "bytes |",
    `Placeholder capacity: ${SIGNATURE_MAX_LENGTH} bytes |`,
    `Re-signed: ${resigned}`);

  if (cmsSize > SIGNATURE_MAX_LENGTH) {
    throw new Error(
      `CMS signature too large: ${cmsSize} bytes (max ${SIGNATURE_MAX_LENGTH})`,
    );
  }

  // Pad to fill the entire placeholder
  sigHex = sigHex.padEnd(SIGNATURE_MAX_LENGTH * 2, "0");

  /* 8 — insert signature hex into Contents placeholder */
  // Freeze a snapshot of bytes outside Contents for integrity check
  const beforeContents = updatedBytes.slice(0, contentsIdx);
  const afterContents = updatedBytes.slice(contentsEnd);

  for (let i = 0; i < sigHex.length; i++) {
    updatedBytes[contentsIdx + 1 + i] = sigHex.charCodeAt(i);
  }

  // Integrity check: no bytes outside Contents should have changed
  for (let i = 0; i < beforeContents.length; i++) {
    if (updatedBytes[i] !== beforeContents[i]) {
      throw new Error(`Integrity violation: byte ${i} changed (before Contents)`);
    }
  }
  for (let i = 0; i < afterContents.length; i++) {
    if (updatedBytes[contentsEnd + i] !== afterContents[i]) {
      throw new Error(`Integrity violation: byte ${contentsEnd + i} changed (after Contents)`);
    }
  }

  console.log("[pdfSign] Signature embedded. Final PDF:", updatedBytes.length, "bytes");

  return {
    signedPdf: updatedBytes,
    signatureHex: sigHex.replace(/0+$/, ""),
    diagnostics: {
      byteRange,
      pdfSize: updatedBytes.length,
      placeholderSize: SIGNATURE_MAX_LENGTH,
      cmsSize,
      dataToSignHash: dataHash,
      resignedAuthAttrs: resigned,
    },
  };
}
