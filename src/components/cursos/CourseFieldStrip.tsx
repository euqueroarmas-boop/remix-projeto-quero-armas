import { Course } from '@/shared/data/coursesCatalog';
import { Wrench, ShieldAlert, Check } from 'lucide-react';
import fieldStripImg from '@/assets/cursos/operador-pistola-field-strip.jpg';

interface CourseFieldStripProps {
  course: Course;
}

export const CourseFieldStrip = ({ course }: CourseFieldStripProps) => {
  if (!course.fieldStrip?.enabled) return null;
  const { fieldStrip } = course;

  return (
    <div className="space-y-10">
      {/* Imagem dominante com overlay tipo "field strip card" */}
      <div className="relative overflow-hidden rounded-md border border-border/60 bg-background">
        <img
          src={fieldStripImg}
          alt="Pistola desmontada em mesa de manutenção, com ferramentas de limpeza e munições — ambiente controlado, arma descarregada."
          width={1920}
          height={1080}
          className="aspect-[16/9] w-full object-cover"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-sm border border-accent/50 bg-background/80 px-3 py-1.5 backdrop-blur-sm sm:left-6 sm:top-6">
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent))]" />
          <span className="font-heading text-[10px] uppercase tracking-[0.3em] text-accent">
            Field Strip · 01
          </span>
        </div>
        <p className="absolute inset-x-4 bottom-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:inset-x-6 sm:bottom-5">
          {fieldStrip.imageCaption}
        </p>
      </div>

      {/* Bloco de copy + bullets */}
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-accent/60" />
            <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-accent">
              {fieldStrip.eyebrow}
            </p>
          </div>
          <h3 className="mb-3 font-heading text-2xl uppercase leading-[1.1] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {fieldStrip.title}
          </h3>
          <p className="mb-8 font-heading text-xl uppercase leading-tight tracking-tight text-accent sm:text-2xl">
            {fieldStrip.highlight}
          </p>
          <div className="space-y-4 text-base text-muted-foreground sm:text-lg">
            {fieldStrip.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div>
          <ol className="space-y-3">
            {fieldStrip.bullets.map((b, i) => (
              <li
                key={b}
                className="group flex items-start gap-4 rounded-md border border-border/50 bg-surface-elevated/40 p-4 transition-colors hover:border-accent/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 font-heading text-xs text-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="pt-1 text-sm text-foreground/90 sm:text-base">{b}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-start gap-3 rounded-md border border-border/50 bg-surface-overlay/60 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {fieldStrip.legalNote}
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Wrench className="size-3.5 text-accent" />
            <span>Manutenção de campo · 1º escalão</span>
            <Check className="size-3.5 text-accent" />
            <span>Sob supervisão</span>
          </div>
        </div>
      </div>
    </div>
  );
};
