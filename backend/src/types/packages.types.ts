export interface PackagePlan {
  name: string;
  priceAVista: number;
  priceInstallments?: number;
  monthlyFee?: number;
  monthlyFeeDescription?: string;
  features: string[];
  highlighted?: boolean;
}

export interface PackagesQuote {
  id: string;
  clientName: string;
  projectName: string;
  projectDescription: string;
  referenceUrl?: string;
  plans: PackagePlan[];
  deliveryDays: string;
  paymentTerms: string;
  paymentMethod: string;
  paymentMethods: string[];
  installments: number;
  validityDays: number;
  createdAt: string;
}
