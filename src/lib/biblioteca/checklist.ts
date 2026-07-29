import { db, type ChecklistRecord, type ChecklistItemRecord } from "./db";
import { CHECKLIST_TEMPLATE, extractChecklistItemsFromText } from "./checklist-template";

export interface CreateChecklistInput {
  titulo: string;
  procedimento?: string;
  inspectionId?: number;
  sourceDocId?: number;
  sourceDocNome?: string;
  sourcePage?: number;
  sourceTrecho?: string;
}

export async function createChecklistFromSource(
  input: CreateChecklistInput,
): Promise<number> {
  const now = Date.now();
  const rec: ChecklistRecord = {
    titulo: input.titulo,
    procedimento: input.procedimento,
    inspectionId: input.inspectionId,
    sourceDocId: input.sourceDocId,
    sourceDocNome: input.sourceDocNome,
    sourcePage: input.sourcePage,
    status: "rascunho",
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    createdBy: "local",
  };
  const id = await db.checklists.add(rec);

  const items: ChecklistItemRecord[] = CHECKLIST_TEMPLATE.map((t, i) => ({
    checklistId: id,
    secao: t.secao,
    texto: t.texto,
    status: "pendente",
    ordem: i,
    createdAt: now,
  }));

  // Extract items from norma trecho (when provided)
  if (input.sourceTrecho) {
    const extracted = extractChecklistItemsFromText(input.sourceTrecho, 10);
    let ordem = items.length;
    for (const t of extracted) {
      items.push({
        checklistId: id,
        secao: "durante",
        texto: t,
        status: "pendente",
        ordem: ordem++,
        sourceDocId: input.sourceDocId,
        sourcePage: input.sourcePage,
        sourceTrecho: t,
        createdAt: now,
      });
    }
  }

  await db.checklistItems.bulkAdd(items);
  return id;
}
