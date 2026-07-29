import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, CheckCircle2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const LS_DISMISS_PERMANENT = "vianorma_pwa_install_dismissed";
const LS_SNOOZE_UNTIL = "vianorma_pwa_install_snooze_until";
const LS_INSTALLED = "vianorma_pwa_installed";
const OPEN_EVENT = "vianorma:open-install-prompt";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BIPEvent | null = null;

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS Safari
  const iosStandalone = window.navigator.standalone === true;
  return Boolean(mq || iosStandalone);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function isIncompatibleWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Instagram/Facebook/TikTok in-app browsers
  return /(FBAN|FBAV|Instagram|Line|TikTok|MicroMessenger)/i.test(ua);
}

export function openInstallPromptManually() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function InstallPwaPrompt() {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [manuallyRequested, setManuallyRequested] = useState(false);

  const shouldSuppress = useCallback(() => {
    if (typeof window === "undefined") return true;
    if (isStandalone()) return true;
    if (localStorage.getItem(LS_INSTALLED) === "1") return true;
    if (localStorage.getItem(LS_DISMISS_PERMANENT) === "1") return true;
    const snooze = localStorage.getItem(LS_SNOOZE_UNTIL);
    if (snooze && Date.now() < Number(snooze)) return true;
    if (isIncompatibleWebView()) return true;
    return false;
  }, []);

  // Capture beforeinstallprompt
  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BIPEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      localStorage.setItem(LS_INSTALLED, "1");
      deferredPrompt = null;
      setCanPrompt(false);
      setOpen(false);
      toast.success("Via Norma instalado com sucesso!");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Auto-show after delay/interaction
  useEffect(() => {
    setIos(isIOS());
    if (shouldSuppress()) return;

    let shown = false;
    const show = () => {
      if (shown) return;
      if (shouldSuppress()) return;
      // Only show if we have a native prompt (Android) or iOS instructions
      if (!deferredPrompt && !isIOS()) return;
      shown = true;
      setOpen(true);
    };

    const timer = window.setTimeout(show, 4000);
    const onInteract = () => window.setTimeout(show, 1500);
    window.addEventListener("pointerdown", onInteract, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onInteract);
    };
  }, [shouldSuppress]);

  // Manual open trigger
  useEffect(() => {
    const onOpen = () => {
      if (isStandalone() || localStorage.getItem(LS_INSTALLED) === "1") {
        toast.info("O aplicativo Via Norma já está instalado.");
        return;
      }
      if (isIncompatibleWebView()) {
        toast.warning("Abra este site no navegador do sistema (Chrome/Safari) para instalar.");
        return;
      }
      if (!deferredPrompt && !isIOS()) {
        toast.info("Este navegador não oferece instalação automática. Use o menu do navegador.");
        return;
      }
      setManuallyRequested(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(LS_INSTALLED, "1");
        localStorage.setItem(LS_DISMISS_PERMANENT, "1");
        toast.success("Instalação iniciada. Confira sua tela inicial.");
      } else {
        // 7 days snooze
        localStorage.setItem(LS_SNOOZE_UNTIL, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      }
    } catch (err) {
      console.error(err);
    } finally {
      deferredPrompt = null;
      setCanPrompt(false);
      setOpen(false);
    }
  };

  const handleLater = () => {
    localStorage.setItem(LS_SNOOZE_UNTIL, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setOpen(false);
  };

  const handleNever = () => {
    localStorage.setItem(LS_DISMISS_PERMANENT, "1");
    setOpen(false);
  };

  const handleIosOk = () => {
    if (!manuallyRequested) {
      localStorage.setItem(LS_SNOOZE_UNTIL, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    }
    setOpen(false);
    setManuallyRequested(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-left">Instale o Via Norma</DialogTitle>
              <p className="text-xs text-muted-foreground">Assistente Técnico de Campo</p>
            </div>
          </div>
          <DialogDescription className="pt-3 text-left">
            Tenha acesso rápido à Biblioteca Técnica, consultas offline, Manual SMR, checklists e
            inspeções diretamente na tela inicial do celular.
          </DialogDescription>
        </DialogHeader>

        {ios ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Como instalar no iPhone / iPad:</p>
            <ol className="space-y-2">
              <li className="flex items-start gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>1. Toque no botão <strong>Compartilhar</strong> do Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>2. Selecione <strong>Adicionar à Tela de Início</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>3. Confirme em <strong>Adicionar</strong>.</span>
              </li>
            </ol>
          </div>
        ) : (
          <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Acesso offline à Biblioteca e ao Manual SMR</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Ícone na tela inicial e abertura em tela cheia</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Checklists e inspeções sempre à mão</li>
          </ul>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {ios ? (
            <Button onClick={handleIosOk} className="w-full">Entendi</Button>
          ) : (
            <>
              <Button onClick={handleInstall} disabled={!canPrompt} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Instalar agora
              </Button>
              <div className="flex w-full gap-2">
                <Button variant="outline" onClick={handleLater} className="flex-1">Agora não</Button>
                <Button variant="ghost" onClick={handleNever} className="flex-1">Não mostrar novamente</Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
