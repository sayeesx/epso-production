import React, { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { StockMovement, MovementType } from '../../types';
import { TbSearch, TbArrowUpRight, TbArrowDownLeft, TbFilter, TbCalendar, TbUser } from 'react-icons/tb';

// Helper to format technical IDs / internal codes into clean, human-readable labels
export const formatHumanReference = (
  reference?: string,
  reason?: string,
  movementType?: string
): string => {
  const ref = (reference || '').trim();
  const reasonText = (reason || '').trim();

  // Wage references: WAGE-YYYY-MM-DD
  if (/^wage[-_]/i.test(ref)) {
    const dateMatch = ref.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? `Wage Allocation (${dateMatch[0]})` : 'Wage Allocation';
  }

  // Admin adjustment codes
  if (/^admin[-_]prd[-_]adj/i.test(ref)) {
    return 'Production Adjustment';
  }
  if (/^admin[-_]adj/i.test(ref)) {
    return 'Stock Audit Adjustment';
  }

  // Cover packaging
  if (/^cover[-_]/i.test(ref)) {
    return 'Packaging Cover Consumption';
  }

  // Sales
  if (/^sale reversal/i.test(ref)) {
    return 'Sale Reversal';
  }
  if (/^sale\s*#/i.test(ref)) {
    return 'Snack Sale';
  }

  // Daily closing
  if (/^daily closing/i.test(ref)) {
    const dateMatch = ref.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? `Daily Closing (${dateMatch[0]})` : 'Daily Closing';
  }

  // Packing
  if (/^packing\b/i.test(ref)) {
    const dateMatch = ref.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? `Packaging Record (${dateMatch[0]})` : 'Packaging Record';
  }

  // Run delete / reversal references
  if (/^del run\s*(\S+)\s*reversal/i.test(ref)) {
    const m = ref.match(/^del run\s*(\S+)\s*reversal/i);
    return `Batch ${m ? m[1] : ''} Reversal`;
  }
  if (/^del run\s*(\S+)/i.test(ref)) {
    const m = ref.match(/^del run\s*(\S+)/i);
    return `Batch ${m ? m[1] : ''} Deletion`;
  }
  if (/^reversal of\s*(\S+)/i.test(ref)) {
    const m = ref.match(/^reversal of\s*(\S+)/i);
    return `Batch ${m ? m[1] : ''} Reversal`;
  }
  if (/^run\s*(\S+)\s*edit/i.test(ref)) {
    const m = ref.match(/^run\s*(\S+)\s*edit/i);
    return `Batch ${m ? m[1] : ''} Adjustment`;
  }
  if (/^run\s*(\S+)/i.test(ref)) {
    const m = ref.match(/^run\s*(\S+)/i);
    return `Batch ${m ? m[1] : ''} Output`;
  }

  // UUID or contains UUID
  const isUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(ref);
  if (isUuid) {
    if (movementType === 'production_consumption') return 'Batch Consumption';
    if (movementType === 'production_output') return 'Batch Production';
    if (movementType === 'purchase') return 'Purchase Entry';
    if (movementType === 'adjustment') return 'Stock Adjustment';
    if (reasonText && !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(reasonText)) {
      return reasonText;
    }
    return 'Production Record';
  }

  return ref || 'Stock Record';
};

interface StockLedgerViewProps {
  movements: StockMovement[];
}

export const StockLedgerView: React.FC<StockLedgerViewProps> = ({ movements }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reason && m.reason.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (typeFilter === 'all') return true;
      if (typeFilter === 'purchases') return m.movementType === 'purchase';
      if (typeFilter === 'production_usage') return m.movementType === 'production_consumption';
      if (typeFilter === 'production_output') return m.movementType === 'production_output';
      if (typeFilter === 'wastage') return m.movementType === 'wastage';
      if (typeFilter === 'correction') return m.movementType === 'adjustment';
      if (typeFilter === 'reversal') return m.movementType === 'cancellation_reversal';

      return true;
    });
  }, [movements, searchTerm, typeFilter]);

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'purchase':
        return <Badge variant="success">Purchase</Badge>;
      case 'production_consumption':
        return <Badge variant="default">Batch Usage</Badge>;
      case 'production_output':
        return <Badge variant="success">Finished Output</Badge>;
      case 'wastage':
        return <Badge variant="danger">Wastage</Badge>;
      case 'adjustment':
        return <Badge variant="warning">Count Audit</Badge>;
      case 'cancellation_reversal':
        return <Badge variant="danger">Reversal</Badge>;
      case 'opening':
        return <Badge variant="default">Opening Stock</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-2.5">
        <Input
          placeholder="Search by ingredient, batch #, reference or reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftAddon={<TbSearch className="w-4 h-4" />}
        />

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `All (${movements.length})` },
            { id: 'production_usage', label: 'Batch Usage' },
            { id: 'production_output', label: 'Output' },
            { id: 'purchases', label: 'Purchases' },
            { id: 'wastage', label: 'Wastage' },
            { id: 'correction', label: 'Adjustments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all whitespace-nowrap select-none press-apple ${
                typeFilter === tab.id
                  ? 'bg-forest-700 text-white'
                  : 'bg-white text-charcoal-muted border border-charcoal-border hover:bg-forest-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {filteredMovements.length === 0 ? (
        <Card className="text-center py-10 text-charcoal-muted text-sm">
          No stock transactions found matching your criteria.
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMovements.map((mov) => {
            const isPositive = mov.quantity > 0;

            return (
              <Card
                key={mov.id}
                padding="sm"
                className="hover:border-forest-600/40 transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isPositive ? (
                        <TbArrowUpRight className="w-4 h-4" />
                      ) : (
                        <TbArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-charcoal leading-tight">
                        {mov.itemName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-charcoal-muted mt-0.5">
                        <span title={mov.reference}>{formatHumanReference(mov.reference, mov.reason, mov.movementType)}</span>
                        <span>•</span>
                        <span>{new Date(mov.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold ${
                        isPositive ? 'text-emerald-700' : 'text-charcoal'
                      }`}
                    >
                      {isPositive ? `+${mov.quantity}` : mov.quantity} {mov.unit}
                    </span>
                    <div className="mt-0.5">{getMovementBadge(mov.movementType)}</div>
                  </div>
                </div>

                {/* Ledger balances snapshot */}
                <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-charcoal-border/50 text-[11px]">
                  <span className="text-charcoal-muted">
                    Balance: <span className="font-semibold">{mov.previousBalance}</span> →{' '}
                    <span className="font-bold text-forest-900">{mov.newBalance} {mov.unit}</span>
                  </span>

                  <span className="text-charcoal-muted">
                    By: <span className="font-medium text-charcoal">{mov.operatorName}</span>
                  </span>
                </div>

                {mov.reason && (
                  <p className="text-[11px] text-charcoal-muted bg-canvas p-1.5 rounded-lg border border-charcoal-border/50">
                    <span className="font-semibold text-charcoal">Note:</span> {mov.reason}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
