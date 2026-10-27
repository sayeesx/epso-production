import React from 'react';
import { Modal } from '../ui/Modal';
import { Ingredient } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
  TbDroplet,
  TbSparkles,
  TbLeaf,
  TbFlame,
  TbPlant2,
  TbPackage,
  TbChevronRight,
  TbToolsKitchen2,
} from 'react-icons/tb';

interface BasicIngredientsSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onSelectOil: () => void;
  onSelectBasicIngredient: (ingredient: Ingredient) => void;
}

export const BasicIngredientsSelectorModal: React.FC<BasicIngredientsSelectorModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  onSelectOil,
  onSelectBasicIngredient,
}) => {
  const { language } = useLanguage();

  // Basic ingredients mapping with custom icons and color schemes
  const basicItemsConfig = [
    {
      key: 'oil',
      matchNames: ['ഓയിൽ', 'oil'],
      labelMl: 'ഓയിൽ (Daily Oil)',
      labelEn: 'Daily Oil Usage',
      subMl: 'ഉപയോഗവും ബാക്കിയും രേഖപ്പെടുത്തുക',
      subEn: 'Consumed & Leftover Oil',
      icon: TbDroplet,
      colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
      isOil: true,
    },
    {
      key: 'salt',
      matchNames: ['ഉപ്പ്', 'salt'],
      labelMl: 'ഉപ്പ് (Salt)',
      labelEn: 'Salt',
      subMl: 'റൂളർ: 25 kg വരെ അളക്കാം',
      subEn: 'Ruler: Up to 25 kg',
      icon: TbSparkles,
      colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300',
      isOil: false,
    },
    {
      key: 'cashew_shell',
      matchNames: ['അണ്ടി തോട്', 'cashew'],
      labelMl: 'അണ്ടി തോട് (Cashew Shell)',
      labelEn: 'Cashew Shell',
      subMl: 'റൂളർ: 25 kg വരെ അളക്കാം',
      subEn: 'Ruler: Up to 25 kg',
      icon: TbPackage,
      colorClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
      badgeClass: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300',
      isOil: false,
    },
    {
      key: 'chippli_powder',
      matchNames: ['ചിപ്പ്ളി പൊടി', 'chippli'],
      labelMl: 'ചിപ്പ്ളി പൊടി (Chilli Powder)',
      labelEn: 'Chippli Powder',
      subMl: 'റൂളർ: 25 kg വരെ അളക്കാം',
      subEn: 'Ruler: Up to 25 kg',
      icon: TbFlame,
      colorClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
      badgeClass: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300',
      isOil: false,
    },
    {
      key: 'curry_leaves',
      matchNames: ['കറിവേപ്പില', 'കറിവേപ്പി', 'curry leaves'],
      labelMl: 'കറിവേപ്പില (Curry Leaves)',
      labelEn: 'Curry Leaves',
      subMl: 'റൂളർ: 25 kg വരെ അളക്കാം',
      subEn: 'Ruler: Up to 25 kg',
      icon: TbPlant2,
      colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
      isOil: false,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <TbToolsKitchen2 className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white leading-tight font-malayalam">
              {language === 'ml' ? 'ബേസിക് ചേരുവകൾ' : 'Basic Ingredients'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              {language === 'ml' ? 'ദിവസേനയുള്ള അളവ് രേഖപ്പെടുത്തുക' : 'Select ingredient to record usage'}
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <div className="space-y-2.5 pb-2">
        {basicItemsConfig.map((item) => {
          const matchingIngredient = ingredients.find((i) =>
            item.matchNames.some(
              (name) =>
                i.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(i.name.toLowerCase())
            )
          );

          const stockStr = matchingIngredient
            ? `${Number(matchingIngredient.currentStock).toFixed(1)} ${matchingIngredient.unit}`
            : null;

          const IconComponent = item.icon;

          return (
            <div
              key={item.key}
              onClick={() => {
                onClose();
                if (item.isOil) {
                  onSelectOil();
                } else if (matchingIngredient) {
                  onSelectBasicIngredient(matchingIngredient);
                } else {
                  // Fallback if ingredient was not found by exact name: create mock structure
                  onSelectBasicIngredient({
                    id: `basic-${item.key}`,
                    name: item.labelMl.split(' ')[0],
                    category: 'basic',
                    unit: 'kg',
                    currentStock: 100,
                    minStock: 10,
                    avgCostPerUnit: 0,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }}
              className="p-3.5 rounded-2xl border border-stone-200 dark:border-[#2E2828] bg-stone-50/50 dark:bg-[#181414] hover:bg-white dark:hover:bg-[#201C1C] hover:border-amber-400 dark:hover:border-amber-500/50 transition-all press-apple cursor-pointer flex items-center justify-between gap-3 shadow-2xs group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${item.colorClass}`}
                >
                  <IconComponent className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {language === 'ml' ? item.labelMl : item.labelEn}
                  </h4>
                  <p className="text-[11px] text-stone-400 font-medium font-malayalam truncate">
                    {language === 'ml' ? item.subMl : item.subEn}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {stockStr && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg font-mono ${item.badgeClass}`}
                  >
                    {stockStr}
                  </span>
                )}
                <TbChevronRight className="w-4 h-4 text-stone-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
