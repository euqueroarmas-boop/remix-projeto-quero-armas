import v1Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v1.png.asset.json";
import v2Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v2.png.asset.json";
import v3Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v3.png.asset.json";
import v4Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v4.png.asset.json";
import v5Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v5.png.asset.json";
import v6Asset from "@/assets/mockups/cockpit-z6-completar-cadastro-v6.png.asset.json";

const mockups = [
  { id: 1, title: "v1 · Comando", subtitle: "ASSUMA O COMANDO DO SEU ARSENAL", asset: v1Asset },
  { id: 2, title: "v2 · IA 24/7", subtitle: "DEIXE A IA CUIDAR DOS SEUS PRAZOS POR VOCÊ", asset: v2Asset },
  { id: 3, title: "v3 · Nunca mais", subtitle: "NUNCA MAIS PERCA UM PRAZO DA SUA VIDA TÁTICA", asset: v3Asset },
  { id: 4, title: "v4 · Copiloto", subtitle: "VOCÊ ATIRA. A IA CUIDA DO RESTO.", asset: v4Asset },
  { id: 5, title: "v5 · 4 min hoje", subtitle: "4 MINUTOS HOJE. ANOS DE TRANQUILIDADE DEPOIS.", asset: v5Asset },
  { id: 6, title: "v6 · Missão", subtitle: "COMPLETE A MISSÃO. LIBERE SUA IA.", asset: v6Asset },
];

export default function MockupsPreview() {
  return (
    <div className="min-h-screen bg-[#F2F2F2] p-6">
      <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>
        Cockpit Z6 Light — Completar Cadastro
      </h1>
      <p className="text-sm text-[#666] mb-8">Clique em qualquer imagem para ampliar. Use Ctrl+Click para abrir em nova aba.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockups.map((m) => (
          <div key={m.id} className="bg-white rounded border border-[#E5E5E5] overflow-hidden shadow-sm">
            <div className="bg-[#7A1F2B] text-white px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">Amostra {m.id}</span>
              <h2 className="text-sm font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
                {m.title}
              </h2>
            </div>
            <a href={m.asset.url} target="_blank" rel="noopener noreferrer">
              <img
                src={m.asset.url}
                alt={m.subtitle}
                className="w-full h-auto object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                loading="lazy"
              />
            </a>
            <div className="px-4 py-3 border-t border-[#E5E5E5]">
              <p className="text-xs text-[#0A0A0A] font-medium uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
                {m.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
