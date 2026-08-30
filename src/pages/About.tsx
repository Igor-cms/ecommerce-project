import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import { BenQuote } from "@/components/BenQuote";
import { Button } from "@/components/ui/button";
import { Coffee, RefreshCw, Sun, ArrowRight } from "lucide-react";
import benImage from "@/assets/ben-profile.jpg";

/* ─── Scroll reveal (same pattern as Wholesale) ─── */
const useScrollReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("revealed"); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
};

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`scroll-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

/* ─── Data ─── */
const values = [
  {
    title: "Consistency",
    desc: "No complicated techniques, no worrying about whether you brewed it correctly. Your cup is balanced and easy to work with — every time.",
    icon: RefreshCw,
  },
  {
    title: "Quality",
    desc: "We handle the sourcing, roasting, and development so every bag meets the same dependable standard.",
    icon: Coffee,
  },
  {
    title: "Ritual",
    desc: "Coffee is the pause before the noise, the first clear thought, the reset before everything begins.",
    icon: Sun,
  },
];

const pillars = [
  { heading: "A familiar taste.", body: "Sweetness, comfort, and reliability in every cup." },
  { heading: "A reliable ritual.", body: "A moment you can count on, morning after morning." },
  { heading: "A better start.", body: "Confidence that your day begins on the right note." },
];

/* ─── Page ─── */
const About = () => {
  usePageSEO({
    title: "About",
    description: "Legendary Everyday is a coffee concept by Ben Morrow — built around the belief that how you start your morning shapes the rest of your day.",
  });

  return (
    <div className="min-h-screen bg-background">

      {/* 1 — Hero */}
      <section className="pt-16 pb-10 md:pt-24 md:pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-4">Our Story</p>
            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[0.95] mb-6 text-primary">
              Legendary Everyday
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground italic max-w-xl mx-auto">
              A coffee concept built around a simple belief.
            </p>
          </Reveal>
          <div className="mt-10 flex justify-center">
            <div className="w-24 border-t border-primary/40 animate-expand-line origin-center" />
          </div>
        </div>
      </section>

      {/* 2 — Manifesto */}
      <section className="px-6 pb-12 md:pb-16">
        <Reveal>
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <p className="text-xl md:text-2xl font-body leading-relaxed text-foreground/90">
              <span className="italic font-medium text-primary">How you start your morning shapes the rest of your day.</span>
            </p>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Coffee isn't just a beverage — it's a moment. It's the pause before the noise, the first clear thought, the reset before everything begins. Legendary Everyday exists to make that moment dependable, enjoyable, and something you actually look forward to waking up for.
            </p>
          </div>
        </Reveal>
      </section>

      {/* 3 — Two-column: Story + Values */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">

          {/* Left — Story */}
          <Reveal delay={100}>
            <div className="space-y-6">
              <p className="text-xs tracking-editorial uppercase text-muted-foreground">The Approach</p>
              <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
                We remove the pressure and keep the pleasure. No complicated techniques, no worrying about whether you brewed it correctly. We handle the sourcing, roasting, and development so your cup is consistent, balanced, and easy to work with.
              </p>
              <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
                You just make it, take a sip, and start your day feeling ready.
              </p>
            </div>
          </Reveal>

          {/* Right — Values */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal delay={250}>
              <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-6">What Drives Us</p>
              <div className="space-y-6">
                {values.map((v) => (
                  <div key={v.title} className="border-l-2 border-primary/30 pl-5 transition-all duration-300 hover:border-primary group">
                    <div className="flex items-center gap-2 mb-1">
                      <v.icon className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
                      <h3 className="font-display text-lg font-semibold">{v.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3.5 — Ben Profile */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="w-16 border-t border-border mx-auto mb-10" />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-start">
            <Reveal delay={100}>
              <img
                src={benImage}
                alt="Ben Morrow — Founder of Legendary Everyday"
                className="w-full h-auto"
                loading="lazy"
              />
            </Reveal>
            <Reveal delay={200}>
              <div className="space-y-6">
                <div>
                  <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-2">Founder</p>
                  <h2 className="font-display text-3xl md:text-4xl font-semibold mb-2">Ben Morrow</h2>
                  <p className="text-sm text-muted-foreground italic">Coffee Professional, Roaster & Educator</p>
                </div>
                <div className="space-y-4 text-base md:text-lg text-foreground/90 leading-relaxed">
                  <p>
                    Ben Morrow is a coffee professional, roaster, and educator, and the founder of Legendary Everyday. Originally from Melbourne, he came up through café service before moving into competition coffee, winning Coffee Masters titles in both New York and London and developing a reputation for combining technical precision with relaxed, welcoming hospitality.
                  </p>
                  <p>
                    He was previously a co-founder of Manhattan Coffee Roasters in Rotterdam, where his work centred on roasting, sourcing, and building producer relationships.
                  </p>
                  <p>
                    Today his focus is education, collaboration, and the everyday experience of coffee — helping people understand what they taste and why it matters, without making specialty coffee feel exclusive. Through writing, training, and industry projects, Ben's approach treats coffee not as a luxury object, but as a daily ritual worth doing carefully and sharing generously.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4 — Roasting Partnership */}
      {/* 4 — Roasting Partnership */}
      <section className="px-6 pb-20 md:pb-28">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 border-t border-border mx-auto mb-10" />
            <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-4">Our Partnership</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">
              Roasted with Guido Specialty Coffee
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Our coffees are roasted in close partnership with Guido Specialty Coffee in Romania, focusing on sweetness, comfort, and reliability. The goal isn't to impress you once — it's to show up for you every morning.
            </p>
          </div>
        </Reveal>
      </section>

      {/* 5 — Philosophy pillars */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-8 text-center">Our Philosophy</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <Reveal key={p.heading} delay={i * 120}>
                <div className="border-2 border-primary/25 p-10 transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 text-center">
                  <span className="text-xs text-primary/40 font-display">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-xl font-semibold mb-3 italic mt-2">{p.heading}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — Ben Quote */}
      <section className="px-6 pb-20 md:pb-28">
        <Reveal>
          <div className="max-w-xl mx-auto">
            <BenQuote
              quote="Because being legendary doesn't happen all at once. It happens every day."
              size="lg"
            />
          </div>
        </Reveal>
      </section>

      {/* 7 — CTA */}
      <section className="px-6 pb-24 md:pb-32 pt-10">
        <div className="w-16 border-t border-border mx-auto mb-12" />
        <Reveal>
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="font-display text-3xl md:text-5xl font-semibold">
              Ready for Your Legendary Everyday?
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Routine, confidence, and a small daily win — starting with your next cup.
            </p>
            <Button asChild className="rounded-none py-6 px-10 text-sm tracking-editorial uppercase group">
              <Link to="/coffee">
                Shop Coffee <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default About;
