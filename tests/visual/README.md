# Testes de Regressão Visual (Mobile)

Snapshot testing focado em **overflow horizontal** e **quebras de layout** nas
rotas principais do módulo Biblioteca Técnica do Via Norma.

## O que é validado

Para cada rota (`/`, `/biblioteca`, `/biblioteca/documentos`,
`/biblioteca/favoritos`, `/biblioteca/historico`, `/biblioteca/glossario`,
`/biblioteca/admin`, `/inspecao`, `/relatorios`) em 4 viewports mobile
(retrato 360/390 e paisagem 667/844):

1. **Overflow do documento** — falha se `scrollWidth > clientWidth`.
2. **Overflow por elemento** — falha se qualquer elemento visível excede a
   borda direita do viewport.
3. **Diferença visual** — compara pixel a pixel com a baseline e falha se a
   proporção de pixels alterados ultrapassar 2%.

## Como rodar

Com o dev server ativo em `http://localhost:8080`:

```bash
# 1ª execução — cria a baseline (revisar as imagens antes de commitar)
python tests/visual/regression.py --update

# Execuções seguintes — compara contra a baseline
python tests/visual/regression.py
```

Código de saída `0` = OK, `1` = regressão detectada.

## Artefatos

- `tests/visual/baseline/` — snapshots-referência (versionados).
- `tests/visual/current/` — última execução.
- `tests/visual/diff/` — imagens de diferença para falhas visuais.
- `tests/visual/report.json` — relatório completo (métricas + falhas).

## Atualizando a baseline

Após uma mudança de UI intencional, rode com `--update` e revise os PNGs em
`tests/visual/baseline/` antes de comitar.
