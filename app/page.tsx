import dynamic from 'next/dynamic';
import { Navbar, HeroSection } from '@/components/landing';
import { SectionSkeleton } from '@/components/landing/section-skeleton';

const StatsSection = dynamic(() => import('@/components/landing/stats-section').then(m => ({ default: m.StatsSection })), { loading: () => <SectionSkeleton /> });
const FeaturesSection = dynamic(() => import('@/components/landing/features-section').then(m => ({ default: m.FeaturesSection })), { loading: () => <SectionSkeleton /> });
const GettingStartedSection = dynamic(() => import('@/components/landing/getting-started-section').then(m => ({ default: m.GettingStartedSection })), { loading: () => <SectionSkeleton /> });
const ScreenshotCarousel = dynamic(() => import('@/components/landing/screenshot-carousel').then(m => ({ default: m.ScreenshotCarousel })), { loading: () => <SectionSkeleton /> });
const TechStack = dynamic(() => import('@/components/landing/tech-stack').then(m => ({ default: m.TechStack })), { loading: () => <SectionSkeleton /> });
const TestimonialsSection = dynamic(() => import('@/components/landing/testimonials-section').then(m => ({ default: m.TestimonialsSection })), { loading: () => <SectionSkeleton /> });
const CTASection = dynamic(() => import('@/components/landing/cta-section').then(m => ({ default: m.CTASection })), { loading: () => <SectionSkeleton /> });
const Footer = dynamic(() => import('@/components/landing/footer').then(m => ({ default: m.Footer })), { loading: () => <SectionSkeleton /> });

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cobalt Skymap',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Windows, macOS, Linux',
  description:
    'A powerful astronomy application for stargazing, observation planning, and astrophotography. Powered by Stellarium Web Engine.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'AstroAir',
    url: 'https://github.com/AstroAir',
  },
  downloadUrl: 'https://github.com/AstroAir/skymap/releases',
  softwareVersion: '1.0.0',
  license: 'https://opensource.org/licenses/MIT',
  programmingLanguage: ['TypeScript', 'Rust'],
  featureList: [
    'Real-time sky rendering',
    'Observation planning',
    'FOV simulation',
    'Equipment management',
    'Multi-language support',
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen min-h-dvh bg-background">
        <Navbar />
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <GettingStartedSection />
        <ScreenshotCarousel />
        <TechStack />
        <TestimonialsSection />
        <CTASection />
        <Footer />
      </main>
    </>
  );
}
