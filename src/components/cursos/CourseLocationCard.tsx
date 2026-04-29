import { Button } from '@/components/ui/button';
import { MapPin, Clock, Calendar, MessageCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { Course, buildWhatsAppLink } from '@/shared/data/coursesCatalog';

interface CourseLocationCardProps {
  course: Course;
}

export const CourseLocationCard = ({ course }: CourseLocationCardProps) => {
  const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
  const { location } = course;
  const mapsQuery = encodeURIComponent(`${location.name}, ${location.address}, ${location.city} - ${location.state}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsEmbed = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-surface-elevated/40">
      <div className="grid gap-0 lg:grid-cols-2">
        {/* Info */}
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="mb-2 font-heading text-xs uppercase tracking-[0.25em] text-accent">Local oficial</p>
            <h3 className="mb-4 font-heading text-2xl uppercase leading-tight text-foreground sm:text-3xl">
              {location.name}
            </h3>
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  {location.address}, {location.city} — {location.state}, {location.zip}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <Calendar className="size-4 text-accent" />
                <span>
                  <strong className="font-heading uppercase tracking-wide">{course.weekday}</strong>
                  {course.schedule && ` · ${course.schedule}`}
                </span>
              </div>
              {course.duration && (
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Clock className="size-4 text-accent" />
                  <span>{course.duration}</span>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>Estrutura de clube de tiro com acompanhamento de instrutor.</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1 font-heading uppercase tracking-[0.15em]">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 size-4" /> Chamar no WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1 font-heading uppercase tracking-[0.15em]">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" /> Ver no mapa
              </a>
            </Button>
          </div>
        </div>
        {/* Map */}
        <div className="relative min-h-[280px] border-t border-border/40 lg:border-l lg:border-t-0">
          <iframe
            src={mapsEmbed}
            title={`Mapa — ${location.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full grayscale-[0.6] contrast-[0.95]"
            allowFullScreen
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-background/40 via-transparent to-transparent" />
        </div>
      </div>
    </div>
  );
};