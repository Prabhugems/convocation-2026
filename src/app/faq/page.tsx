'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import {
  ChevronDown,
  MapPin,
  GraduationCap,
  Package,
  RefreshCw,
  Mail,
  Search,
  Calendar,
  Clock,
  Navigation,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface FAQ {
  question: string;
  answer: string | string[];
}

interface FAQCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  faqs: FAQ[];
}

const faqData: FAQCategory[] = [
  {
    id: 'convocation',
    title: 'Convocation Details',
    icon: MapPin,
    iconColor: 'text-blue-400',
    faqs: [
      {
        question: 'When is the Convocation Ceremony?',
        answer: '27th August 2026 at 6:00 PM',
      },
      {
        question: 'Where is the venue?',
        answer: [
          'Biswa Bangla Convention & Exhibition Center, Kolkata',
          'Address: Canal Bank Rd, DG Block (Newtown), Action Area I, Newtown, West Bengal 700156',
        ],
      },
      {
        question: 'How far is the venue from the airport?',
        answer: 'Approximately 30 minutes / 10.7 km from Netaji Subhas Chandra Bose International Airport',
      },
      {
        question: 'What should I bring to the convocation?',
        answer: [
          'Photo ID (Aadhar/Passport/Driving License)',
          'Your digital badge (on phone or printed)',
          'Formal attire',
        ],
      },
      {
        question: 'Is there a dress code?',
        answer: 'Yes, formal attire is required. Gowns will be provided at the venue.',
      },
    ],
  },
  {
    id: 'certificate',
    title: 'Certificate Collection',
    icon: GraduationCap,
    iconColor: 'text-purple-400',
    faqs: [
      {
        question: 'How do I collect my certificate at the venue?',
        answer: [
          '1. Show your badge/QR code at Registration counter',
          '2. Collect gown from Gown Counter (₹1000: ₹500 rent + ₹500 refundable deposit)',
          '3. Attend the ceremony',
          '4. Return gown and collect ₹500 deposit refund',
          '5. Collect your certificate',
        ],
      },
      {
        question: "What if I can't attend the convocation?",
        answer: 'Your certificate will be dispatched to your registered address via DTDC or India Post after the event.',
      },
      {
        question: 'Can someone else collect my certificate?',
        answer: 'No, certificates must be collected in person with valid ID proof matching your registration.',
      },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping & Delivery',
    icon: Package,
    iconColor: 'text-green-400',
    faqs: [
      {
        question: 'How will my certificate be shipped?',
        answer: 'Via DTDC courier or India Post (Speed Post) based on availability in your area.',
      },
      {
        question: 'How long does delivery take?',
        answer: '5-7 business days for DTDC, 7-10 days for India Post.',
      },
      {
        question: 'How do I track my shipment?',
        answer: "Use the \"Track Your Certificate\" page with your convocation number. You'll also receive tracking details via email once dispatched.",
      },
      {
        question: 'What if my address is incorrect?',
        answer: 'Update your address using the "Update Address" button on the Track page BEFORE your address label is printed. Once printed, changes cannot be made.',
      },
    ],
  },
  {
    id: 'changes',
    title: 'Changes & Updates',
    icon: RefreshCw,
    iconColor: 'text-yellow-400',
    faqs: [
      {
        question: 'Can I change my attendance status?',
        answer: 'Yes, you can update your attendance status until 28th July 2026 (30 days before the convocation). Email connect@amasi.in to make changes. After this deadline, attendance status cannot be modified.',
      },
      {
        question: 'What is the last date to update my address?',
        answer: 'You can update your address until your address label is printed. We recommend updating before 28th July 2026 to ensure your certificate is dispatched to the correct address.',
      },
      {
        question: "What if I marked \"attending\" but can't come?",
        answer: 'Your certificate will be returned to head office after the convocation and dispatched to your address.',
      },
      {
        question: 'Can I update my address after the label is printed?',
        answer: 'No, once the address label is printed, changes cannot be made. Contact connect@amasi.in for assistance.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Contact & Support',
    icon: Mail,
    iconColor: 'text-red-400',
    faqs: [
      {
        question: 'Who do I contact for certificate queries?',
        answer: 'Email: connect@amasi.in',
      },
      {
        question: "I haven't received any updates about my certificate?",
        answer: 'Check your spam folder. Track your status using your convocation number on our Track page. For further assistance, email connect@amasi.in',
      },
      {
        question: 'Where can I find more information about AMASICON 2026?',
        answer: 'Visit the official conference website: https://amasicon2026.com',
      },
    ],
  },
];

function AccordionItem({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-1 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        <span className="text-white font-medium pr-4">{faq.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-white/60 shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pb-4 px-1">
          {Array.isArray(faq.answer) ? (
            <ul className="space-y-2">
              {faq.answer.map((item, index) => (
                <li key={index} className="text-white/70 text-sm flex items-start gap-2">
                  <span className="text-white/40 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : faq.answer.includes('https://') ? (
            <p className="text-white/70 text-sm">
              Visit the official conference website:{' '}
              <a
                href="https://amasicon2026.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                amasicon2026.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          ) : faq.answer.includes('connect@amasi.in') ? (
            <p className="text-white/70 text-sm">
              {faq.answer.split('connect@amasi.in').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <a
                      href="mailto:connect@amasi.in"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      connect@amasi.in
                    </a>
                  )}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-white/70 text-sm">{faq.answer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({ category, searchQuery }: { category: FAQCategory; searchQuery: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const Icon = category.icon;

  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return category.faqs;
    const query = searchQuery.toLowerCase();
    return category.faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        (Array.isArray(faq.answer)
          ? faq.answer.some((a) => a.toLowerCase().includes(query))
          : faq.answer.toLowerCase().includes(query))
    );
  }, [category.faqs, searchQuery]);

  if (filteredFaqs.length === 0) return null;

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${category.iconColor}`} />
        </div>
        <h2 className="text-lg font-semibold text-white">{category.title}</h2>
      </div>
      <div>
        {filteredFaqs.map((faq, index) => (
          <AccordionItem
            key={index}
            faq={faq}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>
    </GlassCard>
  );
}

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const hasResults = useMemo(() => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return faqData.some((category) =>
      category.faqs.some(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          (Array.isArray(faq.answer)
            ? faq.answer.some((a) => a.toLowerCase().includes(query))
            : faq.answer.toLowerCase().includes(query))
      )
    );
  }, [searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Frequently Asked{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Questions
          </span>
        </h1>
        <p className="text-white/60 max-w-xl mx-auto">
          Everything you need to know about the AMASI Convocation 2026
        </p>
      </div>

      {/* Important Deadlines Alert */}
      <div className="mb-8 p-5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-amber-300">Important Deadlines</h2>
            <p className="text-amber-200/70 text-sm">Please note these critical dates</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">
              Last Date for Changes
            </p>
            <p className="text-white font-semibold text-lg">28th July 2026</p>
            <p className="text-white/60 text-xs mt-1">Attendance status & address updates</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">
              Address Update Cutoff
            </p>
            <p className="text-white font-semibold text-lg">Before Label Print</p>
            <p className="text-white/60 text-xs mt-1">Recommended by 28th July 2026</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">
              Convocation Date
            </p>
            <p className="text-white font-semibold text-lg">27th August 2026</p>
            <p className="text-white/60 text-xs mt-1">6:00 PM at Kolkata</p>
          </div>
        </div>
      </div>

      {/* Event Quick Info Card */}
      <GlassCard className="p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Date</p>
              <p className="text-white font-medium">27th August 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Time</p>
              <p className="text-white font-medium">6:00 PM</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs">From Airport</p>
              <p className="text-white font-medium">30 mins / 10.7 km</p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-white font-medium">Biswa Bangla Convention & Exhibition Center</p>
              <p className="text-white/60 text-sm">
                Canal Bank Rd, DG Block (Newtown), Action Area I, Newtown, West Bengal 700156
              </p>
              <a
                href="https://maps.google.com/?q=Biswa+Bangla+Convention+Centre+Kolkata"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-2"
              >
                Open in Google Maps
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search FAQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
        />
      </div>

      {/* No Results */}
      {!hasResults && (
        <GlassCard className="p-8 text-center mb-8">
          <p className="text-white/60">No FAQs found matching &ldquo;{searchQuery}&rdquo;</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            Clear search
          </button>
        </GlassCard>
      )}

      {/* FAQ Categories */}
      <div className="space-y-6">
        {faqData.map((category) => (
          <CategorySection key={category.id} category={category} searchQuery={searchQuery} />
        ))}
      </div>

      {/* Contact CTA */}
      <GlassCard className="p-6 mt-8 text-center">
        <p className="text-white/70 mb-3">Still have questions?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:connect@amasi.in"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            Email Us
          </a>
          <Link
            href="/track"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
          >
            <Search className="w-4 h-4" />
            Track Certificate
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
