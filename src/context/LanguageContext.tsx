import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Language = 'ml' | 'en';

const LANGUAGE_STORAGE_KEY = 'epso_language_preference_v2';

export interface Translations {
  // App & Header
  appTitle: string;
  appSubtitle: string;
  productionInterface: string;
  ownerDashboard: string;
  offlineNotice: string;
  onlineNotice: string;
  switchLanguage: string;

  // Navigation
  navProduction: string;
  navProducts: string;
  navIngredients: string;
  navAdmin: string;
  navSettings: string;

  // Production workflow
  startProduction: string;
  recordProduction: string;
  selectProduct: string;
  searchProductPlaceholder: string;
  quantityToProduce: string;
  unit: string;
  requiredIngredients: string;
  actualConsumption: string;
  stockAvailability: string;
  inStock: string;
  insufficientStock: string;
  recipeNotConfigured: string;
  recipeNotConfiguredDesc: string;
  confirmProduction: string;
  confirmTitle: string;
  confirmDesc: string;
  productionSavedSuccess: string;
  productionRunsHistory: string;
  noProductionRecordsYet: string;
  operator: string;
  notes: string;
  cancelRun: string;
  cancelRunConfirm: string;
  cancellationReason: string;
  runStatusCompleted: string;
  runStatusCancelled: string;

  // Catalogue Management (Shared permission for cook & owner)
  addProduct: string;
  editProduct: string;
  productName: string;
  sku: string;
  wholesalePrice: string;
  deactivate: string;
  activate: string;
  deleteProduct: string;
  deleteIngredient: string;
  addIngredient: string;
  editIngredient: string;
  ingredientName: string;
  category: string;
  categoryBasic: string;
  categoryOther: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  adjustStock: string;
  stockMovementHistory: string;

  // Admin & Security
  adminTitle: string;
  adminSubtitle: string;
  enterPin: string;
  pinPlaceholder: string;
  unlockAdmin: string;
  pinSetupTitle: string;
  pinSetupDesc: string;
  recoveryPhraseTitle: string;
  recoveryPhraseDesc: string;
  forgotPin: string;
  recoverAccess: string;
  logoutAdmin: string;
  sessionExpires: string;
  auditLogsTitle: string;
  databaseHealthTitle: string;
  totalProducts: string;
  totalIngredients: string;
  todayProductionRuns: string;
  todayProductionOutput: string;
  runsInPeriod: string;
  outputInPeriod: string;
  mostProducedSnacks: string;
  ingredientUsageSummary: string;
  noDataInPeriod: string;
  exportCsv: string;
  dateRangeToday: string;
  dateRange7Days: string;
  dateRange30Days: string;
  customRange: string;

  // Common UI
  save: string;
  cancel: string;
  close: string;
  confirm: string;
  search: string;
  filter: string;
  loading: string;
  error: string;
  success: string;
  malayalam: string;
  english: string;
}

const mlTranslations: Translations = {
  appTitle: 'എപ്സോ പ്രൊഡക്ഷൻ',
  appSubtitle: 'ലഘുഭക്ഷണ നിർമ്മാണ & പ്രൊഡക്ഷൻ മാനേജ്‌മെന്റ്',
  productionInterface: 'അടുക്കള & പ്രൊഡക്ഷൻ',
  ownerDashboard: 'ഉടമസ്ഥൻ ഡാഷ്‌ബോർഡ്',
  offlineNotice: 'ഇന്റർനെറ്റ് കണക്ഷൻ ലഭ്യമല്ല. ഓഫ്ലൈൻ മോഡ്.',
  onlineNotice: 'ഇന്റർനെറ്റ് കണക്ഷൻ പുനഃസ്ഥാപിച്ചു.',
  switchLanguage: 'ഭാഷ മാറ്റുക (English)',

  navProduction: 'പ്രൊഡക്ഷൻ',
  navProducts: 'ഉൽപ്പന്നങ്ങൾ',
  navIngredients: 'ചേരുവകൾ',
  navAdmin: 'അഡ്മിൻ',
  navSettings: 'ക്രമീകരണങ്ങൾ',

  startProduction: 'പുതിയ പ്രൊഡക്ഷൻ ആരംഭിക്കുക',
  recordProduction: 'പ്രൊഡക്ഷൻ വിവരങ്ങൾ രേഖപ്പെടുത്തുക',
  selectProduct: 'ഉൽപ്പന്നം തിരഞ്ഞെടുക്കുക',
  searchProductPlaceholder: 'ഉൽപ്പന്നം തിരയുക...',
  quantityToProduce: 'നിർമ്മിക്കേണ്ട അളവ് (കിലോ / എണ്ണം)',
  unit: 'യൂണിറ്റ്',
  requiredIngredients: 'ആവശ്യമായ ചേരുവകൾ (Recipe)',
  actualConsumption: 'ഉപയോഗിച്ച ചേരുവകളുടെ അളവ്',
  stockAvailability: 'സ്റ്റോക്ക് ലഭ്യത',
  inStock: 'സ്റ്റോക്കുണ്ട്',
  insufficientStock: 'സ്റ്റോക്ക് കുറവാണ്',
  recipeNotConfigured: 'റെസിപ്പി ക്രമീകരിച്ചിട്ടില്ല',
  recipeNotConfiguredDesc: 'ഈ ഉൽപ്പന്നത്തിന് ചേരുവകളുടെ അനുപാതം ചേർത്തിട്ടില്ല. ചേരുവകൾ നേരിട്ട് നൽകാവുന്നതാണ്.',
  confirmProduction: 'സ്ഥിരീകരിച്ച് സേവ് ചെയ്യുക',
  confirmTitle: 'പ്രൊഡക്ഷൻ ബാച്ച് സ്ഥിരീകരിക്കുക',
  confirmDesc: 'ഈ പ്രൊഡക്ഷൻ സേവ് ചെയ്യുമ്പോൾ ചേരുവകളുടെ സ്റ്റോക്ക് കുറയുകയും ഉൽപ്പന്നത്തിന്റെ സ്റ്റോക്ക് കൂടുകയും ചെയ്യും.',
  productionSavedSuccess: 'പ്രൊഡക്ഷൻ വിവരങ്ങൾ വിജയകരമായി രേഖപ്പെടുത്തി!',
  productionRunsHistory: 'സമീപകാല പ്രൊഡക്ഷൻ ചരിത്രം',
  noProductionRecordsYet: 'പ്രൊഡക്ഷൻ വിവരങ്ങൾ ഇതുവരെ ചേർത്തിട്ടില്ല',
  operator: 'ഓപ്പറേറ്റർ / ജീവനക്കാരൻ',
  notes: 'കുറിപ്പുകൾ',
  cancelRun: 'റദ്ദാക്കുക',
  cancelRunConfirm: 'ഈ ബാച്ച് റദ്ദാക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ? ഉപയോഗിച്ച ചേരുവകൾ സ്റ്റോക്കിലേക്ക് തിരികെ വരും.',
  cancellationReason: 'റദ്ദാക്കാനുള്ള കാരണം',
  runStatusCompleted: 'പൂർത്തിയായി',
  runStatusCancelled: 'റദ്ദാക്കി',

  addProduct: 'പുതിയ ഉൽപ്പന്നം ചേർക്കുക',
  editProduct: 'ഉൽപ്പന്നം മാറ്റുക',
  productName: 'ഉൽപ്പന്നത്തിന്റെ പേര്',
  sku: 'എസ്.കെ.യു (SKU)',
  wholesalePrice: 'മൊത്തവില (₹)',
  deactivate: 'നിഷ്ക്രിയമാക്കുക',
  activate: 'സജീവമാക്കുക',
  deleteProduct: 'ഡിലീറ്റ് ചെയ്യുക',
  deleteIngredient: 'ഡിലീറ്റ് ചെയ്യുക',
  addIngredient: 'പുതിയ ചേരുവ ചേർക്കുക',
  editIngredient: 'ചേരുവ മാറ്റുക',
  ingredientName: 'ചേരുവയുടെ പേര്',
  category: 'വിഭാഗം',
  categoryBasic: 'ബേസിക് (Category A)',
  categoryOther: 'മറ്റു ചേരുവകൾ (Category B)',
  currentStock: 'നിലവിലെ സ്റ്റോക്ക്',
  minStock: 'കുറഞ്ഞ സ്റ്റോക്ക് പരിധി',
  costPerUnit: 'യൂണിറ്റ് ചിലവ് (₹)',
  adjustStock: 'സ്റ്റോക്ക് ക്രമീകരിക്കുക',
  stockMovementHistory: 'സ്റ്റോക്ക് മൂവ്മെന്റ് ലെഡ്ജർ',

  adminTitle: 'ഉടമസ്ഥൻ അഡ്മിൻ കൺസോൾ',
  adminSubtitle: 'സുരക്ഷിത ഫാക്ടറി മാനേജ്‌മെന്റ് & റിപ്പോർട്ടുകൾ',
  enterPin: 'ഉടമസ്ഥന്റെ 6-അക്ക പിൻ നമ്പർ നൽകുക',
  pinPlaceholder: '••••••',
  unlockAdmin: 'അൺലോക്ക് ചെയ്യുക',
  pinSetupTitle: 'ആദ്യമായി അഡ്മിൻ പിൻ സെറ്റ് ചെയ്യുക',
  pinSetupDesc: 'സുരക്ഷയ്ക്കായി നിങ്ങളുടെ 6-അക്ക സ്വകാര്യ പിൻ നമ്പറും വീണ്ടെടുക്കൽ വാക്യവും രേഖപ്പെടുത്തുക.',
  recoveryPhraseTitle: 'വീണ്ടെടുക്കൽ വാക്യം (Recovery Phrase)',
  recoveryPhraseDesc: 'പിൻ മറന്നുപോയാൽ അക്കൗണ്ട് തിരികെ ലഭിക്കാൻ ഈ വാക്യം സൂക്ഷിക്കുക.',
  forgotPin: 'പിൻ മറന്നുപോയോ?',
  recoverAccess: 'അക്കൗണ്ട് വീണ്ടെടുക്കുക',
  logoutAdmin: 'അഡ്മിൻ ലോഗ്ഔട്ട്',
  sessionExpires: 'സെഷൻ കാലാവധി',
  auditLogsTitle: 'ഓഡിറ്റ് ലോഗുകൾ (സുരക്ഷ & മാറ്റങ്ങൾ)',
  databaseHealthTitle: 'ഡാറ്റാബേസ് & കണക്ഷൻ സ്റ്റാറ്റസ്',
  totalProducts: 'ആകെ ഉൽപ്പന്നങ്ങൾ',
  totalIngredients: 'ആകെ ചേരുവകൾ',
  todayProductionRuns: 'ഇന്നത്തെ റണ്ണുകൾ',
  todayProductionOutput: 'ഇന്നത്തെ നിർമ്മാണം',
  runsInPeriod: 'തിരഞ്ഞെടുത്ത കാലയളവിലെ റണ്ണുകൾ',
  outputInPeriod: 'ആകെ നിർമ്മാണ അളവ്',
  mostProducedSnacks: 'ഏറ്റവും കൂടുതൽ നിർമ്മിച്ച ലഘുഭക്ഷണങ്ങൾ',
  ingredientUsageSummary: 'ചേരുവകളുടെ ഉപഭോഗം',
  noDataInPeriod: 'തിരഞ്ഞെടുത്ത കാലയളവിൽ പ്രൊഡക്ഷൻ രേഖകളില്ല.',
  exportCsv: 'റിപ്പോർട്ട് CSV ആയി ഡൗൺലോഡ് ചെയ്യുക',
  dateRangeToday: 'ഇന്ന്',
  dateRange7Days: 'കഴിഞ്ഞ 7 ദിവസം',
  dateRange30Days: 'കഴിഞ്ഞ 30 ദിവസം',
  customRange: 'മറ്റു തീയതികൾ',

  save: 'സേവ് ചെയ്യുക',
  cancel: 'റദ്ദാക്കുക',
  close: 'അടയ്ക്കുക',
  confirm: 'സ്ഥിരീകരിക്കുക',
  search: 'തിരയുക...',
  filter: 'ഫിൽട്ടർ',
  loading: 'ഡാറ്റ ലോഡ് ചെയ്യുന്നു...',
  error: 'തകരാർ സംഭവിച്ചു',
  success: 'വിജയകരം',
  malayalam: 'മലയാളം',
  english: 'English',
};

const enTranslations: Translations = {
  appTitle: 'Epso Production',
  appSubtitle: 'Snack Manufacturing & Production Management',
  productionInterface: 'Kitchen & Production',
  ownerDashboard: 'Owner Dashboard',
  offlineNotice: 'No internet connection. Running in offline mode.',
  onlineNotice: 'Internet connection restored.',
  switchLanguage: 'സ്വിച്ച് ചെയ്യുക (മലയാളം)',

  navProduction: 'Production',
  navProducts: 'Products',
  navIngredients: 'Ingredients',
  navAdmin: 'Admin',
  navSettings: 'Settings',

  startProduction: 'Start Production',
  recordProduction: 'Record Production Batch',
  selectProduct: 'Select Snack Product',
  searchProductPlaceholder: 'Search product...',
  quantityToProduce: 'Quantity to Produce',
  unit: 'Unit',
  requiredIngredients: 'Required Ingredients (Recipe Formula)',
  actualConsumption: 'Actual Ingredient Consumption',
  stockAvailability: 'Stock Availability',
  inStock: 'In Stock',
  insufficientStock: 'Low Stock',
  recipeNotConfigured: 'Recipe not configured',
  recipeNotConfiguredDesc: 'This product does not have a recipe formula yet. You can enter ingredient amounts manually.',
  confirmProduction: 'Confirm & Save Production',
  confirmTitle: 'Confirm Production Run',
  confirmDesc: 'Saving this record will deduct ingredient stocks and increment finished product inventory in database.',
  productionSavedSuccess: 'Production record saved successfully!',
  productionRunsHistory: 'Recent Production History',
  noProductionRecordsYet: 'No production records yet',
  operator: 'Operator / Cook',
  notes: 'Notes / Remarks',
  cancelRun: 'Cancel Run',
  cancelRunConfirm: 'Are you sure you want to cancel this batch? Consumed ingredients will be restored to inventory.',
  cancellationReason: 'Reason for Cancellation',
  runStatusCompleted: 'Completed',
  runStatusCancelled: 'Cancelled',

  addProduct: 'Add Product',
  editProduct: 'Edit Product',
  productName: 'Product Name',
  sku: 'SKU Code',
  wholesalePrice: 'Wholesale Price (₹)',
  deactivate: 'Deactivate',
  activate: 'Activate',
  deleteProduct: 'Delete Product',
  deleteIngredient: 'Delete Ingredient',
  addIngredient: 'Add Ingredient',
  editIngredient: 'Edit Ingredient',
  ingredientName: 'Ingredient Name',
  category: 'Category',
  categoryBasic: 'Basic (Category A)',
  categoryOther: 'Other Ingredients (Category B)',
  currentStock: 'Current Stock',
  minStock: 'Minimum Stock Alert',
  costPerUnit: 'Cost per Unit (₹)',
  adjustStock: 'Adjust Stock Balance',
  stockMovementHistory: 'Stock Movement Ledger',

  adminTitle: 'Owner Admin Console',
  adminSubtitle: 'Secure Manufacturing Oversight & Real Analytics',
  enterPin: 'Enter 6-Digit Owner PIN',
  pinPlaceholder: '••••••',
  unlockAdmin: 'Unlock Admin',
  pinSetupTitle: 'Initial Owner PIN Setup',
  pinSetupDesc: 'Establish your secure 6-digit owner PIN and secret recovery phrase.',
  recoveryPhraseTitle: 'Recovery Phrase / Secret',
  recoveryPhraseDesc: 'Keep this phrase safe to recover access if PIN is lost or forgotten.',
  forgotPin: 'Forgot PIN?',
  recoverAccess: 'Recover Access',
  logoutAdmin: 'Logout Admin',
  sessionExpires: 'Session Expiry',
  auditLogsTitle: 'Audit Logs (Security & Data Trail)',
  databaseHealthTitle: 'Database & Connection Health',
  totalProducts: 'Total Products',
  totalIngredients: 'Total Ingredients',
  todayProductionRuns: 'Runs Today',
  todayProductionOutput: 'Today Output',
  runsInPeriod: 'Runs in Selected Period',
  outputInPeriod: 'Total Output in Period',
  mostProducedSnacks: 'Most Produced Snacks',
  ingredientUsageSummary: 'Ingredient Consumption Summary',
  noDataInPeriod: 'No production records in selected date range.',
  exportCsv: 'Export Summary as CSV',
  dateRangeToday: 'Today',
  dateRange7Days: 'Last 7 Days',
  dateRange30Days: 'Last 30 Days',
  customRange: 'Custom Dates',

  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  search: 'Search...',
  filter: 'Filter',
  loading: 'Loading database records...',
  error: 'An error occurred',
  success: 'Success',
  malayalam: 'മലയാളം',
  english: 'English',
};

export type TranslationFunction = ((key: keyof Translations) => string) & Translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language) || 'ml';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const rawTranslations = language === 'ml' ? mlTranslations : enTranslations;
  const t = useMemo(() => {
    const fn = (key: keyof Translations) => rawTranslations[key] || (key as string);
    return Object.assign(fn, rawTranslations) as TranslationFunction;
  }, [rawTranslations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
