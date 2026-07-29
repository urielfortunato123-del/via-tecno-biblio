# Biblioteca Técnica — Expansão (Modo Campo, Relatório, Checklist, Glossário, OCR, Manual SMR)

## Ponto crítico antes de começar

O arquivo enviado `SAC_Sistema_Administracao_Conservacao.pdf` tem **90 MB**. Isso tem consequências reais que precisam de decisão sua:

- **Não cabe no bundle do app** (o build ficaria com ~90 MB só desse PDF, quebra deploy e primeiro carregamento em 4G).
- **Não cabe no precache do Service Worker** de forma confiável em celular (Safari/iOS impõe limites agressivos, Android varia por fabricante).
- **IndexedDB aceita**, mas ocupa cota preciosa que o usuário precisa para fotos de fiscalização, relatórios e OCR.

### Opções (preciso que você escolha)

1. **Hospedar o PDF via Lovable Assets (CDN)** + baixar 1x no primeiro acesso e guardar em IndexedDB. O app fica leve, e depois do 1º acesso funciona 100% offline. **Recomendado.**
2. **Gerar índice pré-processado offline** (JSON com páginas/chunks/glossário/search-index) e embutir só o JSON no app (~poucos MB). O PDF continua no CDN e só é baixado quando o usuário abrir o visualizador. Busca funciona sem baixar o PDF.
3. **Embutir o PDF em `public/`** mesmo com 90 MB (não recomendado; pode inviabilizar deploy e uso em campo com dados móveis).

Vou seguir com **Opção 1 + Opção 2 combinadas** salvo se você preferir outra: gero o índice pré-processado agora no sandbox, embuto o JSON no app, e o PDF fica no CDN Lovable Assets baixado sob demanda para IndexedDB. Assim atende o requisito "offline obrigatório após primeiro acesso" sem inflar o app.

## Escopo — ordem de implementação

Vou implementar em fases, cada uma verificável. Se você quiser cortar algo, me diga antes.

### Fase 1 — Manual SMR embutido (Opção 1+2)
- Upload do PDF para Lovable Assets (CDN).
- Script offline no sandbox extrai texto por página com pdfjs e gera `src/lib/biblioteca/smr-index.json` (metadados, páginas, chunks, glossário parseado das seções de glossário do PDF).
- Bootstrap no primeiro acesso: registra doc SMR no Dexie, importa índice pré-gerado, baixa PDF do CDN em background e salva Blob no `blobs` table. Barra de progresso real.
- Hash + versionamento do índice para reprocessar só quando mudar.
- Marcar como `protected: true` no schema para bloquear exclusão por usuário comum.

### Fase 2 — Modo Campo (inspeção + painel Biblioteca)
- Novas tabelas Dexie: `inspections`, `inspectionRefs`, `inspectionPhotos`.
- Nova rota `/inspecao/$id` com formulário (rodovia, km, sentido, regional, empresa, serviço, fotos, observações).
- Botão "Consultar Biblioteca Técnica" abre `Sheet` lateral (desktop) / bottom sheet (mobile) usando shadcn `Sheet`. Estado da inspeção preservado via context.
- Ações no resultado: Abrir página, Copiar trecho, **Usar nesta inspeção** (grava em `inspectionRefs`), Gerar checklist, Favoritar.

### Fase 3 — Checklist automático
- Tabelas: `checklists`, `checklistItems`.
- Template fixo com 6 seções (Antes/Durante/Depois/Fotos/Medição/Observações) conforme spec.
- Extração heurística de itens adicionais do trecho da norma (regex para "deve/deverá/verificar/conferir" + bullets). Cada item extraído carrega `sourcePage` e `sourceDocId`; sem definição inventada.
- UI: check/uncheck, adicionar/editar/excluir item manual, anexar foto, salvar rascunho, concluir, associar à inspeção.

### Fase 4 — Relatório PDF offline
- Usar `jspdf` + `jspdf-autotable` (adicionar dependência; pdfjs-dist já existe mas é para leitura).
- Layout: cabeçalho, identificação, localização, serviço, fotos (Antes/Durante/Depois com legenda), checklist, medições, normas com fonte completa (doc/órgão/versão/cap/item/pág/trecho), observações, responsável.
- Preview antes de exportar. Salva no histórico com Blob no Dexie. Fallback quando cota excedida: exportar sem salvar.

### Fase 5 — Glossário Técnico
- Nova rota `/biblioteca/glossario`.
- Fonte primária: `smr-index.json` (seção glossário parseada). Fonte secundária: termos frequentes indexados nos demais docs.
- Busca, navegação alfabética A-Z, paginação real (não renderizar tudo), filtros por categoria/órgão, termos relacionados (co-ocorrência no mesmo trecho + mapa SYNONYMS existente).
- Sem definições inventadas: quando não houver definição formal, mostrar "Termo encontrado nos documentos, mas sem definição formal identificada" e listar trechos.

### Fase 6 — OCR (Tesseract.js) para PDFs escaneados importados
- Só ativa quando `hasText=false` na importação (não roda no SMR se já tiver texto).
- Web Worker próprio, `por+eng`, progresso real por página, pausar/continuar/cancelar.
- Nova tabela `ocrPages`. Atualiza `pages` e reindexação parcial.
- Assets do Tesseract adicionados ao cache para funcionar offline.

### Fase 7 — Sync (fundação, sem backend real)
- `syncQueue` com status `local|pending|synced|error`, `retryCount`, `lastSyncError`.
- Todos os registros novos ganham campos `syncStatus`, `createdBy` (por enquanto `"local"` — sem auth Cloud implementada).
- UI de status (pendentes/última sync/tentar novamente). Sem servidor conectado, fica em `local`.

## Detalhes técnicos

- **PDF do SMR no CDN**: `lovable-assets create --file /mnt/user-uploads/SAC_Sistema_Administracao_Conservacao.pdf` → pointer em `src/lib/biblioteca/smr.pdf.asset.json`. Fetch → Blob → IndexedDB no primeiro acesso.
- **Índice pré-processado**: gerado por script Python/Node no sandbox lendo o PDF com pdfjs (headless). Saída: um `smr-index.json` (~2-5 MB estimado) importado como módulo. Se ficar >5 MB, split em `smr-pages.json` + `smr-search-index.json` + `smr-glossary.json` conforme spec.
- **Dexie schema**: nova `version(2)` aditiva com upgrade. Sem apagar dados. Novas tabelas listadas na Fase 6.
- **PWA/Service Worker**: **não vou adicionar** SW nesta iteração (a skill PWA proíbe SW em preview Lovable e o benefício real está no publish). Ofereço isso como fase posterior quando você publicar. O offline funciona via IndexedDB puro, que é o que importa em campo.
- **Autenticação/permissões**: não há sistema de auth ainda. Vou marcar o SMR como `protected: true` e a UI de admin só permite substituir, não excluir. Se quiser roles reais, isso exige Lovable Cloud (posso ativar em fase separada).
- **Testes**: `bun run build` ao final de cada fase + Playwright headless nas rotas críticas.

## Fora de escopo desta entrega

- Backend/servidor de sync real (sem Cloud ainda).
- Autenticação e roles (admin vs comum) — hoje todo mundo é "admin local".
- Service Worker/precache PWA (fase posterior no deploy).
- Assinatura digital do responsável no relatório (não há sistema de identidade ainda).

## Confirmação necessária

1. **Estratégia do PDF de 90 MB**: sigo com **CDN + índice pré-processado embutido** (Opção 1+2)? Ou você prefere embutir os 90 MB em `public/`?
2. **Ordem de fases**: implemento tudo em sequência até quebrar? Ou você quer priorizar uma fase específica (ex: só Fase 1+2+4 nesta rodada)?
3. **Dependências novas**: `jspdf`, `jspdf-autotable`, `tesseract.js`. OK adicionar?
