// Centralized configuration for URLs and settings
// Change NEXT_PUBLIC_BASE_URL in environment variables when deploying

export const config = {
  // Base URL - defaults to localhost for development
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',

  // App name
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'AMASI Certificate Management System',

  // Generate track URL for a graduate
  getTrackUrl: (convNumber: string) =>
    `${config.baseUrl}/track?q=${encodeURIComponent(convNumber)}`,

  // Generate badge image URL
  getBadgeUrl: (convNumber: string) =>
    `${config.baseUrl}/api/badge/${encodeURIComponent(convNumber)}`,

  // Generate print badge URL (for pre-printed paper)
  getPrintBadgeUrl: (convNumber: string) =>
    `${config.baseUrl}/api/badge/${encodeURIComponent(convNumber)}/print`,

  // Generate station URL
  getStationUrl: (stationId: string) =>
    `${config.baseUrl}/stations/${stationId}`,

  // Generate admin URL
  getAdminUrl: () => `${config.baseUrl}/admin`,

  // Generate FAQ URL
  getFaqUrl: () => `${config.baseUrl}/faq`,

  // Convocation details
  convocation: {
    date: '27th August 2026',
    time: '6:00 PM IST',
    gatesOpen: '4:30 PM',
    venue: 'Biswa Bangla Convention Center',
    city: 'Kolkata, West Bengal',
    gownRent: 500,
    gownDeposit: 500, // Refundable upon return
    gownTotal: 1000, // Rent + Deposit
    certificateCollectionDate: '28th - 30th August 2026',
    addressDeadline: '28th July 2026',
  },

  // Contact info
  contact: {
    email: 'connect@amasi.in',
    supportEmail: 'connect@amasi.in',
  },
};

export default config;
