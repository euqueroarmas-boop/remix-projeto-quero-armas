import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SeoHead from "@/components/SeoHead";

const NotFound = () => {
  return (
    <>
    <SeoHead title="Página não encontrada | WMTi" description="A página que você procura não existe." noindex />
    <div className="flex min-h-screen items-center justify-center section-dark">
      <div className="text-center container">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Erro 404
        </p>
        <h1 className="text-6xl md:text-8xl font-bold text-primary mb-4">404</h1>
        <p className="font-body text-lg text-muted-foreground mb-8">
          Página não encontrada.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          <ArrowLeft size={16} />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
