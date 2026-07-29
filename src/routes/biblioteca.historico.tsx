import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Trash2, X, Clock } from "lucide-react";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  clearHistoryAll,
  clearHistoryOlderThan,
  deleteHistoryEntry,
  isHistoryEnabled,
  setHistoryEnabled,
} from "@/lib/biblioteca/hooks";

export const Route = createFileRoute("/biblioteca/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const items = useLiveQuery(
    () => db.history.orderBy("createdAt").reverse().limit(200).toArray(),
    [],
    [],
  );
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);

  useEffect(() => {
    setSaveHistory(isHistoryEnabled());
  }, []);

  const handleClearAll = async () => {
    await clearHistoryAll();
    setClearAllOpen(false);
    toast.success("Histórico de pesquisas limpo.");
  };

  const handleDeleteOne = async (id?: number) => {
    if (!id) return;
    await deleteHistoryEntry(id);
  };

  const handleClearOld = async () => {
    const n = await clearHistoryOlderThan(30);
    toast.success(
      n > 0
        ? `${n} pesquisa(s) com mais de 30 dias removida(s).`
        : "Nenhuma pesquisa antiga (>30 dias) encontrada.",
    );
  };

  const handleToggleSave = (checked: boolean) => {
    setSaveHistory(checked);
    setHistoryEnabled(checked);
    if (!checked && (items?.length ?? 0) > 0) {
      setDisableOpen(true);
    }
  };

  const handleConfirmDisableClear = async () => {
    await clearHistoryAll();
    setDisableOpen(false);
    toast.success("Histórico existente apagado.");
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Preferences */}
        <Card className="flex items-center justify-between p-4">
          <div className="space-y-0.5">
            <Label htmlFor="save-history" className="text-sm font-medium">
              Salvar histórico de pesquisas
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando desativado, novas pesquisas não serão armazenadas.
            </p>
          </div>
          <Switch
            id="save-history"
            checked={saveHistory}
            onCheckedChange={handleToggleSave}
          />
        </Card>

        {/* Header with actions */}
        <Card className="p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Últimas Pesquisas
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearOld}
                    disabled={!items || items.length === 0}
                  >
                    <Clock className="mr-1 h-4 w-4" />
                    Limpar pesquisas antigas
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove pesquisas com mais de 30 dias</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setClearAllOpen(true)}
                    disabled={!items || items.length === 0}
                    aria-label="Limpar histórico"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar histórico</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!items || items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma pesquisa realizada.
            </div>
          ) : (
            <div className="divide-y">
              {items.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 p-2 text-sm"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{h.query || "(abertura direta)"}</span>
                    {h.docId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        → doc #{h.docId} pág. {h.page ?? 1}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(h.createdAt).toLocaleString("pt-BR")}</span>
                    {h.docId && (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to="/biblioteca/doc/$docId"
                          params={{ docId: String(h.docId) }}
                          search={{ page: h.page ?? 1, q: h.query }}
                        >
                          Abrir
                        </Link>
                      </Button>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDeleteOne(h.id)}
                          aria-label="Excluir esta pesquisa"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir esta pesquisa</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Clear all confirmation */}
        <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar histórico de pesquisas</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja apagar todo o histórico de pesquisas? Esta ação
                não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll}>
                Limpar Histórico
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm clearing existing when disabling preference */}
        <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar histórico existente?</AlertDialogTitle>
              <AlertDialogDescription>
                Você desativou o salvamento de pesquisas. Deseja apagar também o
                histórico já registrado? Favoritos, documentos e glossário não serão
                afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDisableClear}>
                Apagar histórico
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
