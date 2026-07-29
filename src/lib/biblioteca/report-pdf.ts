import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  db,
  type InspectionRecord,
  type InspectionPhotoRecord,
  type InspectionRefRecord,
  type ChecklistRecord,
  type ChecklistItemRecord,
} from "./db";

interface BuildOpts {
  inspection: InspectionRecord;
  photos: InspectionPhotoRecord[];
  refs: InspectionRefRecord[];
  checklists: ChecklistRecord[];
  checklistItems: ChecklistItemRecord[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function fitImage(blob: Blob): Promise<{ dataUrl: string; w: number; h: number }> {
  const dataUrl = await blobToDataUrl(blob);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Falha ao carregar imagem"));
    img.src = dataUrl;
  });
  return { dataUrl, w: img.naturalWidth, h: img.naturalHeight };
}

export async function buildReportPdf(opts: BuildOpts): Promise<Blob> {
  const { inspection, photos, refs, checklists, checklistItems } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const sectionTitle = (t: string) => {
    addPageIfNeeded(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(t, margin, y);
    y += 6;
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
  };
  const kv = (label: string, val?: string) => {
    if (!val) return;
    addPageIfNeeded(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(val), margin + 100, y, { maxWidth: pageWidth - margin - 100 - margin });
    y += 14;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório Técnico de Fiscalização", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} · Via Norma`,
    margin,
    y,
  );
  y += 18;
  doc.setTextColor(40);
  doc.setFontSize(10);

  // Identification
  sectionTitle("1. Identificação da inspeção");
  kv("Título", inspection.titulo);
  kv("Fiscal responsável", inspection.fiscal);
  kv("Data da inspeção", new Date(inspection.createdAt).toLocaleString("pt-BR"));
  kv("Empresa executora", inspection.empresa);
  kv("Serviço", inspection.servico);
  kv("Status", inspection.status);

  sectionTitle("2. Localização");
  kv("Rodovia", inspection.rodovia);
  kv("Km", inspection.km);
  kv("Sentido", inspection.sentido);
  kv("Regional", inspection.regional);
  kv("Município", inspection.municipio);

  sectionTitle("3. Descrição da ocorrência / serviço");
  if (inspection.descricao) {
    const lines = doc.splitTextToSize(inspection.descricao, pageWidth - margin * 2);
    addPageIfNeeded(lines.length * 12 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  } else {
    doc.setTextColor(120);
    doc.text("Não informado.", margin, y);
    doc.setTextColor(40);
    y += 14;
  }

  // Photos
  sectionTitle("4. Registro fotográfico");
  if (photos.length === 0) {
    doc.setTextColor(120);
    doc.text("Sem fotos anexadas.", margin, y);
    doc.setTextColor(40);
    y += 14;
  } else {
    const maxW = (pageWidth - margin * 2 - 20) / 2;
    const maxH = 180;
    let col = 0;
    for (const ph of photos) {
      try {
        const { dataUrl, w, h } = await fitImage(ph.blob);
        const ratio = Math.min(maxW / w, maxH / h);
        const dw = w * ratio;
        const dh = h * ratio;
        addPageIfNeeded(dh + 30);
        const x = margin + col * (maxW + 20);
        doc.addImage(dataUrl, "JPEG", x, y, dw, dh, undefined, "FAST");
        doc.setFontSize(8);
        doc.setTextColor(90);
        const cap = `${ph.fase.toUpperCase()}${ph.legenda ? " — " + ph.legenda : ""}`;
        doc.text(cap, x, y + dh + 10, { maxWidth: maxW });
        doc.setFontSize(10);
        doc.setTextColor(40);
        col++;
        if (col >= 2) {
          col = 0;
          y += dh + 26;
        }
      } catch (e) {
        console.warn("Falha ao inserir foto no relatório", e);
      }
    }
    if (col > 0) y += maxH + 26;
  }

  // Checklists
  sectionTitle("5. Checklist");
  if (checklists.length === 0) {
    doc.setTextColor(120);
    doc.text("Sem checklist associado.", margin, y);
    doc.setTextColor(40);
    y += 14;
  } else {
    for (const cl of checklists) {
      addPageIfNeeded(24);
      doc.setFont("helvetica", "bold");
      doc.text(cl.titulo, margin, y);
      doc.setFont("helvetica", "normal");
      y += 12;
      const rows = checklistItems
        .filter((i) => i.checklistId === cl.id)
        .sort((a, b) => a.ordem - b.ordem)
        .map((i) => [
          i.secao,
          i.texto,
          i.status === "ok"
            ? "OK"
            : i.status === "nao_conforme"
              ? "NC"
              : i.status === "na"
                ? "N/A"
                : "—",
        ]);
      autoTable(doc, {
        startY: y,
        head: [["Seção", "Item", "Status"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [40, 60, 90] },
        margin: { left: margin, right: margin },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // Normas / referências
  sectionTitle("6. Normas e referências técnicas utilizadas");
  if (refs.length === 0) {
    doc.setTextColor(120);
    doc.text("Nenhuma norma vinculada a esta inspeção.", margin, y);
    doc.setTextColor(40);
    y += 14;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Documento", "Órgão", "Versão", "Pág.", "Trecho"]],
      body: refs.map((r) => [
        r.docNome,
        r.orgao ?? "-",
        r.versao ?? "-",
        String(r.page),
        r.trecho.length > 240 ? r.trecho.slice(0, 240) + "…" : r.trecho,
      ]),
      styles: { fontSize: 8, cellPadding: 3, valign: "top" },
      columnStyles: { 4: { cellWidth: 260 } },
      headStyles: { fillColor: [40, 60, 90] },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Observações
  sectionTitle("7. Observações");
  if (inspection.observacoes) {
    const lines = doc.splitTextToSize(inspection.observacoes, pageWidth - margin * 2);
    addPageIfNeeded(lines.length * 12 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 12;
  } else {
    doc.setTextColor(120);
    doc.text("Sem observações.", margin, y);
    doc.setTextColor(40);
    y += 14;
  }

  // Responsável
  sectionTitle("8. Responsável");
  kv("Fiscal", inspection.fiscal || "Não informado");
  kv("Data de geração", new Date().toLocaleString("pt-BR"));

  // Footer with page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 20,
      { align: "right" },
    );
    doc.text("Via Norma — Relatório gerado offline", margin, pageHeight - 20);
  }

  return doc.output("blob");
}

export async function generateAndSaveReport(inspectionId: number): Promise<{
  reportId?: number;
  blob: Blob;
  saved: boolean;
  error?: string;
}> {
  const inspection = await db.inspections.get(inspectionId);
  if (!inspection) throw new Error("Inspeção não encontrada");
  const photos = await db.inspectionPhotos.where("inspectionId").equals(inspectionId).toArray();
  const refs = await db.inspectionRefs.where("inspectionId").equals(inspectionId).toArray();
  const checklists = await db.checklists.where("inspectionId").equals(inspectionId).toArray();
  const clIds = checklists.map((c) => c.id!);
  const checklistItems = clIds.length
    ? await db.checklistItems.where("checklistId").anyOf(clIds).toArray()
    : [];

  const blob = await buildReportPdf({
    inspection,
    photos,
    refs,
    checklists,
    checklistItems,
  });

  // Try to save
  const priorVersions = await db.reports.where("inspectionId").equals(inspectionId).count();
  const versao = priorVersions + 1;
  const now = Date.now();
  const nome = `Relatorio-${inspection.rodovia ?? "insp"}-${inspection.km ?? ""}-v${versao}.pdf`;
  try {
    const reportId = await db.reports.add({
      nome,
      inspectionId,
      rodovia: inspection.rodovia,
      km: inspection.km,
      versao,
      size: blob.size,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      createdBy: "local",
    });
    await db.reportBlobs.put({ reportId, blob });
    return { reportId, blob, saved: true };
  } catch (e) {
    return {
      blob,
      saved: false,
      error:
        e instanceof Error
          ? e.message
          : "Espaço local insuficiente para salvar o relatório. Faça o download manual.",
    };
  }
}
