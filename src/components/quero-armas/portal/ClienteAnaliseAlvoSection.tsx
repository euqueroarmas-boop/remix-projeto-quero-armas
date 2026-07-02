import { BadgeCheck, Crosshair, Lock, Sparkles, Target, Zap } from "lucide-react";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteAnaliseAlvoSection() {
  return (
    <section className="space-y-5">
      <div>
        <div className="text-[14px] font-black uppercase tracking-[0.18em] text-slate-950 md:text-[20px]">
          Análise de Alvo
        </div>
        <h1 className="mt-1 text-[36px] font-black leading-none text-slate-950 md:text-[46px]">
          Seu Disparo, Explicado Pela IA
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 md:text-base">
          Em breve, o Arsenal Inteligente vai analisar seus alvos, identificar padrões de agrupamento e apontar correções
          pontuais para você evoluir com precisão, consistência e segurança.
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[520px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative flex items-center justify-center border-b border-slate-200 bg-white p-8 lg:border-b-0 lg:border-r">
            <div className="absolute left-8 top-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
              <Lock className="h-4 w-4" />
              Arsenal Inteligente Premium
            </div>

            <div className="relative h-[360px] w-[360px] max-w-full rounded-full border border-slate-200 bg-[radial-gradient(circle,#ffffff_0_36%,#f8fafc_37%_39%,#ffffff_40%_54%,#f8fafc_55%_57%,#ffffff_58%_100%)] shadow-inner">
              <div className="absolute inset-8 rounded-full border border-slate-300" />
              <div className="absolute inset-20 rounded-full border border-slate-300" />
              <div className="absolute inset-32 rounded-full border border-slate-900 bg-slate-950" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-200" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-slate-200" />

              <div className="absolute left-[58%] top-[42%] h-5 w-5 rounded-full border-4 border-slate-950 bg-white shadow-sm" />
              <div className="absolute left-[53%] top-[49%] h-4 w-4 rounded-full border-4 border-slate-950 bg-white shadow-sm" />
              <div className="absolute left-[62%] top-[53%] h-4 w-4 rounded-full border-4 border-slate-950 bg-white shadow-sm" />
              <div className="absolute left-[47%] top-[45%] h-3.5 w-3.5 rounded-full border-4 border-slate-950 bg-white shadow-sm" />
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 md:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white">
              <Sparkles className="h-4 w-4" />
              Em construção
            </div>

            <h2 className="mt-6 max-w-xl text-3xl font-black leading-tight text-slate-950 md:text-4xl">
              Você vai saber exatamente o que melhorar no próximo treino.
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
              A IA analisará seus alvos, interpretará a dispersão dos impactos e transformará cada sessão em orientações
              objetivas: postura, empunhadura, visada, acionamento do gatilho, controle de recuo e repetição do fundamento.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Target, title: "Agrupamento", text: "Identifica tendência dos impactos e perda de consistência." },
                { icon: Crosshair, title: "Correção Pontual", text: "Mostra o ajuste prático para o próximo disparo." },
                { icon: Zap, title: "Evolução", text: "Compara treinos e mede ganho real de precisão." },
                { icon: BadgeCheck, title: "Instrução Premium", text: "Conteúdo treinado por instrutor CTT/CBC e por quem sabe dar aula." },
              ].map((item) => (
                <div key={item.title} className="border border-slate-200 bg-slate-50 p-4">
                  <item.icon className="h-5 w-5 text-slate-950" />
                  <div className="mt-3 text-[12px] font-black uppercase tracking-[0.16em] text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 border border-slate-200 bg-white p-5">
              <div className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-950">
                Para membros pagantes
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O recurso será exclusivo para membros do Arsenal Inteligente Premium. A base técnica será treinada por
                instrutor CTT/CBC - Centro Técnico de Treinamento da Companhia Brasileira de Cartuchos - e por profissionais
                que sabem traduzir fundamento em resultado no alvo.
              </p>
              <p className="mt-3 text-[12px] leading-5 text-slate-500">
                Desenvolvimento orientado pela base normativa: {legalBase}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
