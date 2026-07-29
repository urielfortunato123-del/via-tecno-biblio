import type { ChecklistItemRecord } from "./db";

type Secao = ChecklistItemRecord["secao"];

interface TemplateItem {
  secao: Secao;
  texto: string;
}

export const CHECKLIST_TEMPLATE: TemplateItem[] = [
  // ANTES
  { secao: "antes", texto: "Conferir sinalização da área" },
  { secao: "antes", texto: "Registrar condição inicial" },
  { secao: "antes", texto: "Confirmar localização (rodovia e km)" },
  { secao: "antes", texto: "Identificar serviço a ser executado" },
  { secao: "antes", texto: "Verificar riscos e EPIs" },
  { secao: "antes", texto: "Registrar fotos do estado anterior" },
  // DURANTE
  { secao: "durante", texto: "Acompanhar execução" },
  { secao: "durante", texto: "Verificar materiais utilizados" },
  { secao: "durante", texto: "Verificar equipamentos" },
  { secao: "durante", texto: "Conferir procedimento executivo" },
  { secao: "durante", texto: "Registrar não conformidades" },
  { secao: "durante", texto: "Registrar fotos durante a execução" },
  // DEPOIS
  { secao: "depois", texto: "Verificar acabamento" },
  { secao: "depois", texto: "Conferir limpeza da área" },
  { secao: "depois", texto: "Validar execução conforme norma" },
  { secao: "depois", texto: "Registrar pendências" },
  { secao: "depois", texto: "Registrar fotos após a execução" },
  // FOTOS
  { secao: "fotos", texto: "Foto — antes" },
  { secao: "fotos", texto: "Foto — durante" },
  { secao: "fotos", texto: "Foto — depois" },
  { secao: "fotos", texto: "Legenda, data e localização" },
  // MEDIÇÃO
  { secao: "medicao", texto: "Unidade" },
  { secao: "medicao", texto: "Quantidade" },
  { secao: "medicao", texto: "Extensão" },
  { secao: "medicao", texto: "Largura" },
  { secao: "medicao", texto: "Altura ou profundidade" },
  { secao: "medicao", texto: "Área" },
  { secao: "medicao", texto: "Volume" },
  { secao: "medicao", texto: "Observações da medição" },
  // OBSERVAÇÕES
  { secao: "observacoes", texto: "Observações gerais" },
  { secao: "observacoes", texto: "Não conformidades" },
  { secao: "observacoes", texto: "Providências solicitadas" },
  { secao: "observacoes", texto: "Prazo de correção" },
];

/**
 * Extract additional checklist items from a normative excerpt.
 * Purely heuristic: identifies obligation clauses ("deve", "deverá", "verificar", "conferir", ...).
 * Nunca inventa exigência técnica — só copia trecho existente.
 */
export function extractChecklistItemsFromText(
  text: string,
  maxItems = 12,
): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÇ0-9])/);
  const rx =
    /\b(dever[áa]|deve|deverão|obrigat[oó]rio|obrigat[oó]ria|verificar|conferir|garantir|assegurar|executar|realizar|proceder|fiscalizar|acompanhar|inspecionar|medir|registrar|preencher|manter)\b/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    const t = s.trim();
    if (t.length < 20 || t.length > 260) continue;
    if (!rx.test(t)) continue;
    const key = t.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}
