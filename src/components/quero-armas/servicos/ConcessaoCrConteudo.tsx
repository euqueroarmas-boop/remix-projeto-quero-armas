import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Conteúdo explicativo do serviço CR · Atirador Desportivo.
 * Renderizado abaixo das opções do carrinho na página /servicos/concessao-cr.
 * Mantém a identidade Quero Armas (papel + bordô) usando design tokens existentes.
 */

const niveis = [
  {
    tag: "Nível 01 · Inicial",
    armas: "4 armas",
    requisito: "8 treinos ou competições",
    municao: "4.000 + 8.000 .22",
  },
  {
    tag: "Nível 02 · Intermediário",
    armas: "8 armas",
    requisito: "12 treinos + 4 competições",
    municao: "10.000 + 16.000 .22",
  },
  {
    tag: "Nível 03 · Avançado",
    armas: "16 armas (até 4 restritas)",
    requisito: "20 treinos + 6 competições",
    municao: "20.000 + 32.000 .22",
  },
];

const direitos = [
  { tag: "Tiro", titulo: "Praticar tiro esportivo", desc: "Treinar e competir em entidades de tiro filiadas, com respaldo legal." },
  { tag: "Acervo", titulo: "Adquirir e possuir armas", desc: "De 4 a 16 armas conforme o nível — incluindo calibres restritos no nível 3." },
  { tag: "Munição", titulo: "Comprar munição e insumos", desc: "Milhares de cartuchos por ano, em volume crescente por nível." },
  { tag: "Recarga", titulo: "Recarregar munição", desc: "Montar a própria munição com insumos e máquina de recarga." },
  { tag: "Trânsito", titulo: "Viajar para competir", desc: "Transportar a arma entre estados com Guia de Tráfego (GTE)." },
];

const requisitos = [
  { num: "R1", titulo: "Maioridade civil", desc: "Idade mínima e plena capacidade civil." },
  { num: "R2", titulo: "Idoneidade", desc: "Sem antecedentes — incluído no nosso plano." },
  { num: "R3", titulo: "Ocupação lícita", desc: "Comprovação de atividade e residência certa." },
  { num: "R4", titulo: "Aptidão psicológica", desc: "Laudo de psicólogo credenciado." },
  { num: "R5", titulo: "Capacidade técnica", desc: "Aptidão no manuseio de arma de fogo (teste de tiro)." },
  { num: "R6", titulo: "Vínculo desportivo", desc: "Filiação a entidade de tiro — por nossa conta." },
];

const documentos = [
  "Identidade e CPF",
  "Comprovante de residência",
  "Comprovante de ocupação lícita",
  "Laudo de aptidão psicológica",
  "Atestado de capacidade técnica (tiro)",
  "Certidões de antecedentes",
  "Filiação à entidade de tiro",
  "Taxa de emissão (ao final)",
];

const etapas = [
  { titulo: "Filiação desportiva", desc: "Providenciamos sua filiação a entidade de tiro — inclusa por 1 ano." },
  { titulo: "Exames", desc: "Você realiza o exame psicológico e o teste de tiro com credenciados." },
  { titulo: "Dossiê e idoneidade", desc: "Reunimos e validamos toda a documentação. Idoneidade inclusa." },
  { titulo: "Protocolo no SINARM-CAC", desc: "Damos entrada no seu processo de CR no sistema oficial da Polícia Federal." },
  { titulo: "Análise e deferimento", desc: "Acompanhamos o trâmite e respondemos a eventuais exigências." },
  { titulo: "Emissão do CR", desc: "Taxa ao final. Seu certificado é emitido e liberado." },
];

const gteRegras = [
  { k: "GTE", t: "Emitida pelo SINARM-CAC — autoriza o porte de trânsito do acervo." },
  { k: "Condição", t: "Arma desmuniciada, com munição em compartimento separado." },
  { k: "Escopo", t: "Trajeto e período predefinidos entre origem e destino." },
  { k: "Validade", t: "Até 6 meses para treino e competição." },
  { k: "Limite", t: "Não é porte: a arma não pode estar pronta para uso." },
  { k: "Em mãos", t: "Levar sempre CR, CRAF e identidade junto da guia." },
];

const inclusos = [
  { titulo: "Filiação à entidade desportiva", desc: "Inclusa no serviço — por 1 ano." },
  { titulo: "Idoneidade", desc: "Já contemplada no seu plano." },
  { titulo: "Montagem e conferência do dossiê", desc: "Cada documento revisado antes do protocolo." },
  { titulo: "Protocolo no SINARM-CAC", desc: "Entrada do processo conduzida por nós." },
  { titulo: "Acompanhamento até a emissão", desc: "Você é informado a cada etapa do trâmite." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-heading text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
      {children}
    </p>
  );
}

function SectionTitle({ index, eyebrow, children }: { index: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-baseline gap-4">
        <span className="font-heading text-3xl font-light tracking-tight text-muted-foreground/40">
          {index}
        </span>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
        {children}
      </h2>
    </div>
  );
}

export function ConcessaoCrConteudo() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 01 — O QUE É */}
      <section>
        <SectionTitle index="01" eyebrow="O que é">
          O Certificado de Registro
        </SectionTitle>
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          O CR é o documento que registra o cidadão como{" "}
          <span className="font-semibold text-foreground">Atirador Desportivo</span> na categoria
          CAC — Colecionador, Atirador e Caçador. Com ele você pratica o tiro esportivo com
          respaldo legal, adquire e mantém seu acervo, e participa de competições dentro da lei.
        </p>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          Desde 1º de julho de 2025, o registro, o CR e as guias de tráfego dos CACs são
          controlados pela{" "}
          <span className="font-semibold text-accent">Polícia Federal, pelo SINARM-CAC</span>.
        </p>
      </section>

      {/* 02 — DIREITOS */}
      <section>
        <SectionTitle index="02" eyebrow="Direitos do CAC">
          O que você pode fazer como atirador
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {direitos.map((d) => (
            <Card key={d.titulo} className="border-border/70">
              <CardContent className="p-5">
                <div className="mb-2 font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                  › {d.tag}
                </div>
                <h4 className="font-heading text-base font-bold uppercase tracking-tight text-foreground">
                  {d.titulo}
                </h4>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{d.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 03 — NÍVEIS */}
      <section>
        <SectionTitle index="03" eyebrow="Classificação">
          Os três níveis do atirador
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          {niveis.map((n, i) => (
            <Card
              key={n.tag}
              className={`border-border/70 ${i === 2 ? "border-accent/60 bg-accent/5" : ""}`}
            >
              <CardContent className="p-6">
                <Badge variant="outline" className="mb-3 font-mono text-[10px] tracking-widest">
                  {n.tag}
                </Badge>
                <h3 className="font-heading text-2xl font-bold uppercase tracking-tight text-foreground">
                  {n.armas}
                </h3>
                <dl className="mt-5 space-y-3 text-[13px]">
                  <div className="flex justify-between gap-3 border-t border-border/60 pt-3">
                    <dt className="text-muted-foreground">Requisito / 12 meses</dt>
                    <dd className="text-right font-medium text-foreground">{n.requisito}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border/60 pt-3">
                    <dt className="text-muted-foreground">Munição / ano</dt>
                    <dd className="text-right font-medium text-foreground">{n.municao}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-[13px] italic leading-relaxed text-muted-foreground/80">
          A progressão exige permanência de 12 meses em cada nível, com prática comprovada por
          calibre registrado. O nível 3 pode, em caráter excepcional, adquirir até 4 armas
          restritas e 6.000 munições restritas por ano, mediante autorização.
        </p>
      </section>

      {/* 04 — RECARGA */}
      <section>
        <SectionTitle index="04" eyebrow="Insumos">
          Recarga permitida
        </SectionTitle>
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          O atirador pode montar a própria munição. Os insumos são adquiridos dentro do mesmo
          limite total de munição do seu nível — e a{" "}
          <span className="font-semibold text-foreground">prensa de recarga semiprogressiva</span>{" "}
          é o equipamento dessa atividade.
        </p>
        <div className="mt-6">
          <p className="mb-3 font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
            Componentes do cartucho
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {["Estojo", "Espoleta", "Pólvora", "Projétil"].map((c, i) => (
              <div
                key={c}
                className="flex items-center gap-3 border border-border/70 bg-card px-4 py-3"
              >
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-heading text-sm uppercase tracking-wide text-foreground">
                  {c}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 — GTE */}
      <section>
        <SectionTitle index="05" eyebrow="Trânsito interestadual">
          Viajar entre estados para competir
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {gteRegras.map((r) => (
            <div
              key={r.k}
              className="flex gap-4 border border-border/70 bg-card p-4"
            >
              <div className="font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
                {r.k}
              </div>
              <div className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {r.t}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 06 — REQUISITOS */}
      <section>
        <SectionTitle index="06" eyebrow="Elegibilidade">
          Requisitos para obter o CR
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {requisitos.map((r) => (
            <div key={r.num} className="flex gap-4 border border-border/70 bg-card p-4">
              <div className="font-mono text-xs font-bold text-accent">{r.num}</div>
              <div>
                <h4 className="font-heading text-sm font-bold uppercase tracking-tight text-foreground">
                  {r.titulo}
                </h4>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {r.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 07 — DOCUMENTOS */}
      <section>
        <SectionTitle index="07" eyebrow="Checklist">
          Documentos necessários
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {documentos.map((d, i) => (
            <div key={d} className="flex items-center gap-3 border border-border/70 bg-card p-4">
              <span className="font-mono text-xs text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] font-medium text-foreground">{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 08 — PROCESSO */}
      <section>
        <SectionTitle index="08" eyebrow="Processo">
          Como funciona, passo a passo
        </SectionTitle>
        <ol className="space-y-4">
          {etapas.map((e, i) => (
            <li key={e.titulo} className="flex gap-4 border-l-2 border-accent/60 pl-5">
              <span className="font-heading text-2xl font-bold leading-none text-accent">
                {i + 1}
              </span>
              <div>
                <h4 className="font-heading text-base font-bold uppercase tracking-tight text-foreground">
                  {e.titulo}
                </h4>
                <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                  {e.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 09 — ASSESSORIA */}
      <section>
        <SectionTitle index="09" eyebrow="Assessoria">
          Ponta a ponta, com a Quero Armas
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {inclusos.map((it) => (
            <div key={it.titulo} className="flex gap-4 border border-border/70 bg-card p-4">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-bold text-accent"
              >
                ✓
              </span>
              <div>
                <h4 className="font-heading text-sm font-bold uppercase tracking-tight text-foreground">
                  {it.titulo}
                </h4>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {it.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl border-l-2 border-accent/60 pl-4 text-[14px] italic leading-relaxed text-muted-foreground">
          Assessoria especializada conduzida por Instrutor de Armamento e Tiro, do início à
          emissão do seu CR.
        </p>
      </section>
    </div>
  );
}

export default ConcessaoCrConteudo;