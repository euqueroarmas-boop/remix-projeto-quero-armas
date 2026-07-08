import { BadgeCheck, Crosshair, Lock, Sparkles, Target, Zap } from "lucide-react";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteAnaliseAlvoSection() {
  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="text-[14px] font-black uppercase tracking-[0.18em] text-slate-950 md:text-[20px]">
          Análise de Alvo
        </div>
        <h1 className="mt-1 text-[32px] font-black leading-none text-slate-950 md:text-[46px]">
          Seu Disparo, Explicado por Nós
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-5 text-slate-600">
          Em breve, o Arsenal Inteligente analisará seus alvos e apontará correções pontuais para você evoluir com precisão,
          consistência e segurança.
        </p>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="relative flex items-center justify-center border-b border-slate-200 bg-white p-7 pt-16 lg:border-b-0 lg:border-r">
            <div className="absolute left-7 top-7 inline-flex items-center gap-2 rounded-full border border-[#8A0F1D]/30 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8A0F1D]">
              <Lock className="h-4 w-4" />
              Arsenal Inteligente Premium
            </div>

            <div className="relative aspect-square w-full max-w-[340px] rounded-full border border-slate-200 bg-[radial-gradient(circle,#ffffff_0_36%,#f8fafc_37%_39%,#ffffff_40%_54%,#f8fafc_55%_57%,#ffffff_58%_100%)] shadow-inner">
              <div className="absolute inset-8 rounded-full border border-slate-300" />
              <div className="absolute inset-20 rounded-full border border-slate-300" />
              <div className="absolute inset-[36%] rounded-full border border-[#8A0F1D] bg-[#8A0F1D]" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-200" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-slate-200" />

              <div className="absolute left-[58%] top-[42%] h-5 w-5 rounded-full border-4 border-[#8A0F1D] bg-white shadow-sm" />
              <div className="absolute left-[53%] top-[49%] h-4 w-4 rounded-full border-4 border-[#8A0F1D] bg-white shadow-sm" />
              <div className="absolute left-[62%] top-[53%] h-4 w-4 rounded-full border-4 border-[#8A0F1D] bg-white shadow-sm" />
              <div className="absolute left-[47%] top-[45%] h-3.5 w-3.5 rounded-full border-4 border-[#8A0F1D] bg-white shadow-sm" />
            </div>
          </div>

          <div className="flex flex-col justify-center px-7 py-8 md:px-9 md:py-9">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
              <Sparkles className="h-4 w-4" />
              Em construção
            </div>

            <h2 className="mt-4 max-w-xl text-2xl font-black leading-tight text-slate-950 md:text-[30px]">
              Você vai saber exatamente o que melhorar no próximo treino.
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-5 text-slate-600">
              Analisaremos seus alvos, interpretaremos a dispersão dos impactos e transformaremos cada sessão em orientações
              objetivas: postura, empunhadura, visada, acionamento de gatilho, controle de recuo e repetição do fundamento.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                { icon: Target, title: "Agrupamento", text: "Identifica tendência dos impactos e perda de consistência." },
                { icon: Crosshair, title: "Correção Pontual", text: "Mostra o ajuste prático para o próximo disparo." },
                { icon: Zap, title: "Evolução", text: "Compara treinos e mede ganho real de precisão." },
                { icon: BadgeCheck, title: "Instrução Premium", text: "Conteúdo treinado por instrutor CTT/CBC e por quem sabe dar aula." },
              ].map((item) => (
                <div key={item.title} className="grid min-h-[74px] grid-cols-[18px_1fr] gap-x-3 border border-slate-200 bg-slate-50 p-3">
                  <item.icon className="mt-0.5 h-4 w-4 text-slate-950" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-4 text-slate-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border border-[#8A0F1D]/20 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8A0F1D]">
                Para membros pagantes
              </div>
              <p className="mt-2 text-[13px] leading-5 text-slate-600">
                O recurso será exclusivo para membros do Arsenal Inteligente Premium. A base técnica será treinada por
                instrutor CTT/CBC - Centro Técnico de Treinamento da Companhia Brasileira de Cartuchos - e por profissionais
                que sabem traduzir fundamento em resultado no alvo.
              </p>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Desenvolvimento orientado pela base normativa: {legalBase}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
