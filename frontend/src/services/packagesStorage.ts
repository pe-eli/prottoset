const STORAGE_KEY = 'prottoset_packages_quotes';

export interface StoredPackagesPlan {
  name: string;
  priceAVista: number;
  priceInstallments?: number;
  monthlyFee?: number;
  monthlyFeeDescription?: string;
  features: string[];
  highlighted: boolean;
}

export interface StoredPackagesQuote {
  id: string;
  createdAt: string;
  clientName: string;
  projectName: string;
  projectDescription: string;
  referenceUrl?: string;
  plans: StoredPackagesPlan[];
  deliveryDays: string;
  paymentTerms: string;
  paymentMethod: string;
  paymentMethods: string[];
  installments: number;
  validityDays: number;
}

export const packagesStorage = {
  getAll(): StoredPackagesQuote[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  save(quote: StoredPackagesQuote): void {
    const quotes = this.getAll();
    const index = quotes.findIndex((q) => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = quote;
    } else {
      quotes.unshift(quote);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  },

  delete(id: string): void {
    const quotes = this.getAll().filter((q) => q.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  },
};
