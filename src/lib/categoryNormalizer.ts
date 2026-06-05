// Maps free-text category names to standardized EXPENSE_CATEGORIES.
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './expenseCategories';

const ALIASES: Record<string, ExpenseCategory> = {
  // Food & Dining
  food: 'Food & Dining', meal: 'Food & Dining', meals: 'Food & Dining',
  restaurant: 'Food & Dining', restaurants: 'Food & Dining',
  dining: 'Food & Dining', dineout: 'Food & Dining', 'eat out': 'Food & Dining',
  cafe: 'Food & Dining', coffee: 'Food & Dining', lunch: 'Food & Dining',
  dinner: 'Food & Dining', breakfast: 'Food & Dining', takeout: 'Food & Dining',
  // Groceries
  grocery: 'Groceries', groceries: 'Groceries', supermarket: 'Groceries',
  market: 'Groceries', produce: 'Groceries',
  // Transport
  taxi: 'Transport', uber: 'Transport', lyft: 'Transport', bolt: 'Transport',
  bus: 'Transport', 'bus fare': 'Transport', train: 'Transport',
  transport: 'Transport', transportation: 'Transport', commute: 'Transport',
  parking: 'Transport', metro: 'Transport',
  // Fuel
  gas: 'Fuel', gasoline: 'Fuel', petrol: 'Fuel', diesel: 'Fuel', fuel: 'Fuel',
  // Utilities
  utility: 'Utilities', utilities: 'Utilities', water: 'Utilities',
  electricity: 'Utilities', power: 'Utilities', electric: 'Utilities', gas_bill: 'Utilities',
  // Rent / Mortgage
  rent: 'Rent', housing: 'Rent', lease: 'Rent',
  mortgage: 'Mortgage', 'home loan': 'Mortgage',
  // Internet/Phone
  internet: 'Internet', wifi: 'Internet', broadband: 'Internet',
  phone: 'Phone', mobile: 'Phone', cell: 'Phone', cellphone: 'Phone', airtime: 'Phone',
  // Insurance
  insurance: 'Insurance', premium: 'Insurance',
  // Healthcare
  health: 'Healthcare', healthcare: 'Healthcare', medical: 'Healthcare',
  doctor: 'Healthcare', pharmacy: 'Healthcare', hospital: 'Healthcare',
  // Education
  school: 'Education', tuition: 'Education', education: 'Education', course: 'Education', courses: 'Education',
  books: 'Education',
  // Childcare
  daycare: 'Childcare', childcare: 'Childcare', nanny: 'Childcare',
  // Entertainment
  entertainment: 'Entertainment', movie: 'Entertainment', movies: 'Entertainment',
  cinema: 'Entertainment', concert: 'Entertainment', games: 'Entertainment',
  // Subscriptions
  subscription: 'Subscriptions', subscriptions: 'Subscriptions', netflix: 'Subscriptions',
  spotify: 'Subscriptions', youtube: 'Subscriptions', 'apple music': 'Subscriptions',
  // Shopping
  shopping: 'Shopping', amazon: 'Shopping', online: 'Shopping',
  // Clothing
  clothing: 'Clothing', clothes: 'Clothing', apparel: 'Clothing', shoes: 'Clothing',
  // Personal care
  'personal care': 'Personal Care', salon: 'Personal Care', barber: 'Personal Care',
  spa: 'Personal Care', cosmetics: 'Personal Care',
  // Gifts/Donations
  gift: 'Gifts', gifts: 'Gifts',
  donation: 'Donations', donations: 'Donations', charity: 'Donations', tithe: 'Donations',
  // Travel/Hotels
  travel: 'Travel', flight: 'Travel', flights: 'Travel', airfare: 'Travel',
  hotel: 'Hotels', hotels: 'Hotels', airbnb: 'Hotels', lodging: 'Hotels',
  // Taxes/Fees
  tax: 'Taxes', taxes: 'Taxes', vat: 'Taxes',
  fee: 'Fees & Charges', fees: 'Fees & Charges', 'bank fee': 'Fees & Charges',
  charges: 'Fees & Charges', 'service charge': 'Fees & Charges',
  // Savings/Investments
  saving: 'Savings', savings: 'Savings',
  investment: 'Investments', investments: 'Investments', stocks: 'Investments',
  crypto: 'Investments',
  // Business
  business: 'Business', work: 'Business',
  office: 'Office', supplies: 'Office', stationery: 'Office',
  software: 'Software', saas: 'Software', tools: 'Software',
  // Income
  salary: 'Income', wage: 'Income', wages: 'Income', income: 'Income',
  payroll: 'Income', revenue: 'Income', refund: 'Income',
};

const STD_SET = new Set<string>(EXPENSE_CATEGORIES);

export function normalizeCategory(raw: string | null | undefined): ExpenseCategory {
  if (!raw) return 'Other';
  const trimmed = raw.trim();
  // Already canonical?
  if (STD_SET.has(trimmed)) return trimmed as ExpenseCategory;
  // Title-case match?
  const titled = trimmed.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
  if (STD_SET.has(titled)) return titled as ExpenseCategory;
  // Alias lookup
  const key = trimmed.toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  // Partial token match
  for (const token of key.split(/\s+/)) {
    if (ALIASES[token]) return ALIASES[token];
  }
  return 'Other';
}
