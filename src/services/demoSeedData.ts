import { Ingredient, Product, Recipe } from '../types';

// ==============================================================================
// INITIAL EPSO CATALOGUE (EXACT SUPPLIED MALAYALAM NAMES)
// No fake metrics, no invented stock, no demo production runs.
// ==============================================================================

export const INITIAL_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'പെരി പെരി മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'First മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'സാമ്പാർ SP', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ചിപ്പി മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'റോസ്റ്റ്', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'പട്ടാണി', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ഒബിസി', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'കമ്പ്യൂട്ടർ മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ചോളം സ്വീറ്റ് മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ചോളം മസാല മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'പട്ടാണി മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: '3kg കിറ്റ് മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'എപ്സോ കിറ്റ് മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'മണി കടല', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'മുളക് മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'സുടാൻ മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ചില്ലി മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'പയോളി മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'PT മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ദാൽ മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'Sr മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'SPSR മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'സാമ്പാർ LC', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ജീൻസ്', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'ഗാർലിക്ക് pv', unit: 'kg', currentStock: 0, isActive: true },
  { name: 'Sp മിക്സ്ചർ', unit: 'kg', currentStock: 0, isActive: true },
];

export const INITIAL_INGREDIENTS: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Category A: Basic (7 items)
  { name: 'ഓയിൽ', category: 'basic', unit: 'L', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'അണ്ടി തോട്', category: 'basic', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ചിപ്പ്ളി പൊടി', category: 'basic', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കറിവേപ്പില', category: 'basic', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കവർ', category: 'basic', unit: 'pcs', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കൂലി', category: 'basic', unit: 'pcs', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കൂലി പാക്കിങ്', category: 'basic', unit: 'pcs', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },

  // Category B: Other ingredients (36 items)
  { name: 'കടല പൊടി 99', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കടല പൊടി സൂരജ്', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'അരിപ്പൊടി പൊള്ളാച്ചി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'അരിപ്പൊടി 2nd', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'പൂള പൊടി പൊള്ളാച്ചി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'പൂള പൊടി 2nd', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'മൈദ', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കടല ഫസ്റ്റ്', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കടല 2nd', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'പട്ടാണി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ഉണ്ട പൊട്ട്', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'പൊട്ട് കടല', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ചെറുപയർ', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'മമ്പയർ', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ദാൽ പരിപ്പ്', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'മുളക് പൊടി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'സാമ്പാർ പൊടി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'മഞ്ഞൾ പൊടി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ഗരം മസാല', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ബിരിയാണി മസാല', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ചിക്കൻ മസാല', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'മീറ്റ് മസാല', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കായം', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'സദ്യ പൊടി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'അയമോദകം', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കരിം ജീരകം', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കമ്പ്യൂട്ടർ', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ചോളം', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ഒബിസി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'പഞ്ചസാര പൊടി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'വെളുത്തുള്ളി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ചീറുള്ളി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'വലിയ ഉള്ളി', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ഉരുള കിഴങ്ങു', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'കളർ', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
  { name: 'ഉപ്പ്', category: 'other', unit: 'kg', currentStock: 0, minStock: 0, avgCostPerUnit: 0, isActive: true },
];

export const INITIAL_RECIPES: Recipe[] = [];
