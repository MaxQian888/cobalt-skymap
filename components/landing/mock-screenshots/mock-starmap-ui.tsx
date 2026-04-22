import { Star, Target, Compass } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const STARMAP_STARS = [
  { w: 2, t: 12, l: 15, o: 0.8 }, { w: 1, t: 28, l: 42, o: 0.5 }, { w: 3, t: 8, l: 72, o: 0.9 },
  { w: 1, t: 45, l: 88, o: 0.4 }, { w: 2, t: 62, l: 25, o: 0.7 }, { w: 1, t: 78, l: 55, o: 0.3 },
  { w: 2, t: 18, l: 35, o: 0.6 }, { w: 1, t: 55, l: 68, o: 0.5 }, { w: 3, t: 35, l: 12, o: 0.8 },
  { w: 1, t: 72, l: 82, o: 0.4 }, { w: 2, t: 22, l: 58, o: 0.7 }, { w: 1, t: 48, l: 32, o: 0.6 },
  { w: 1, t: 82, l: 45, o: 0.3 }, { w: 2, t: 15, l: 78, o: 0.9 }, { w: 1, t: 38, l: 92, o: 0.5 },
  { w: 2, t: 68, l: 18, o: 0.6 }, { w: 1, t: 52, l: 75, o: 0.4 }, { w: 3, t: 25, l: 48, o: 0.7 },
  { w: 1, t: 85, l: 62, o: 0.3 }, { w: 2, t: 42, l: 8, o: 0.8 },
];

const FEATURED_OBJECTS = [
  {
    name: 'M31 - Andromeda Galaxy',
    ra: 'RA: 00h 42m 44s',
    dec: "Dec: +41° 16'",
    mag: 'Mag: 3.4',
    accentClassName: 'bg-blue-400',
  },
  {
    name: 'M42 - Orion Nebula',
    ra: 'RA: 05h 35m 17s',
    dec: "Dec: -05° 23'",
    mag: 'Mag: 4.0',
    accentClassName: 'bg-emerald-400',
  },
  {
    name: 'Mars - Planet',
    ra: 'RA: 07h 41m 12s',
    dec: "Dec: +24° 05'",
    mag: 'Mag: -1.2',
    accentClassName: 'bg-orange-400',
  },
] as const;

export function MockStarmapUI() {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0a0e27] to-[#1a1e3a] relative overflow-hidden p-4">
      {/* Mock stars */}
      {STARMAP_STARS.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: `${star.w}px`,
            height: `${star.w}px`,
            top: `${star.t}%`,
            left: `${star.l}%`,
            opacity: star.o,
          }}
        />
      ))}
      {/* Mock toolbar */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        {[Star, Target, Compass].map((Icon, i) => (
          <div key={i} className="w-7 h-7 rounded-md bg-white/10 backdrop-blur flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-white/70" />
          </div>
        ))}
      </div>
      {/* Mock info panel */}
      <div className="absolute bottom-3 left-3 right-3">
        <Carousel opts={{ loop: true }} className="mx-8">
          <CarouselContent className="-ml-0">
            {FEATURED_OBJECTS.map((object) => (
              <CarouselItem key={object.name} className="pl-0">
                <div className="bg-black/40 backdrop-blur-md rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${object.accentClassName}`} />
                    <span className="text-white/90 text-xs font-medium">{object.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/50">
                    <span>{object.ra}</span>
                    <span>{object.dec}</span>
                    <span>{object.mag}</span>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious
            variant="ghost"
            className="left-[-2rem] size-7 border border-white/10 bg-black/35 text-white/80 hover:bg-black/50 hover:text-white"
          />
          <CarouselNext
            variant="ghost"
            className="right-[-2rem] size-7 border border-white/10 bg-black/35 text-white/80 hover:bg-black/50 hover:text-white"
          />
        </Carousel>
      </div>
      {/* Mock crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 border border-white/30 rounded-full" />
        <div className="absolute top-1/2 left-0 w-full h-px bg-white/20" />
        <div className="absolute top-0 left-1/2 w-px h-full bg-white/20" />
      </div>
    </div>
  );
}
