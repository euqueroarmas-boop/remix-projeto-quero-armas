import { Button } from '@/components/ui/button';
import { MapPin, Clock, Calendar, MessageCircle, ShieldCheck } from 'lucide-react';
import { Course, buildWhatsAppLink } from '@/shared/data/coursesCatalog';

interface CourseLocationCardProps {
  course: Course;
}

export const CourseLocationCard = ({ course }: CourseLocationCardProps) => {
  const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
  const { location } = course;
  return (
    <div className="rounded-lg border border-border/60 bg-surface-elevated/40 p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-heading text-xs uppercase tracking-[0.2em] text-accent">Local</p>
          <h3 className="mb-2 font-heading text-lg uppercase text-foreground sm:text-xl">{location.name}</h3>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              {location.address}, {location.city} - {location.state}, {location.zip}
            </span>
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Calendar className="size-4 text-accent" />
            <span>
              <strong className="font-heading uppercase tracking-wide">{course.weekday}</strong>
              {course.schedule && ` · ${course.schedule}`}
            </span>
          </div>
          {course.duration && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 text-accent" />
              <span>{course.duration}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-accent" />
            <span>Estrutura de clube de tiro com acompanhamento de instrutor</span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Button asChild className="w-full font-heading uppercase tracking-[0.15em] sm:w-auto">
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 size-4" /> Chamar no WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
};