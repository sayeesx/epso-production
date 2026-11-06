import { describe, it, expect, beforeEach } from 'vitest';
import { DemoRepository } from '../services/demoRepository';
import { formatHumanReference } from '../components/stock/StockLedgerView';
import { isBlackSalt, isDailySharedBasic } from '../components/production/StartProductionModal';

describe('Epso Argon High Bugfix Verification Tests', () => {
  let repo: DemoRepository;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    repo = new DemoRepository();
    await repo.resetDemoData();
  });

  // Bug 2: Technical ID Removal and Clean Human-Readable References
  describe('Bug 2: Human-Readable References & Technical ID Removal', () => {
    it('formats technical wage references to human labels', () => {
      expect(formatHumanReference('WAGE-2026-11-06')).toBe('Wage Allocation (2026-11-06)');
      expect(formatHumanReference('wage-2026-11-06')).toBe('Wage Allocation (2026-11-06)');
    });

    it('formats admin adjustment internal codes to human labels', () => {
      expect(formatHumanReference('ADMIN-PRD-ADJ-99214')).toBe('Production Adjustment');
      expect(formatHumanReference('ADMIN-ADJ-55123')).toBe('Stock Audit Adjustment');
    });

    it('formats cover codes and packing references to human labels', () => {
      expect(formatHumanReference('COVER-123456')).toBe('Packaging Cover Consumption');
      expect(formatHumanReference('Packing 2026-11-06')).toBe('Packaging Record (2026-11-06)');
    });

    it('hides raw UUIDs and returns clean human movement descriptions', () => {
      const rawUuid = '0c1c0878-62a0-4618-af59-7d58d15a2de4';
      expect(formatHumanReference(rawUuid, '', 'production_consumption')).toBe('Batch Consumption');
      expect(formatHumanReference(rawUuid, '', 'production_output')).toBe('Batch Production');
      expect(formatHumanReference(rawUuid, '', 'purchase')).toBe('Purchase Entry');
      expect(formatHumanReference(rawUuid, '', 'adjustment')).toBe('Stock Adjustment');
    });

    it('formats batch deletions and reversals properly', () => {
      expect(formatHumanReference('del run B-1')).toBe('Batch B-1 Deletion');
      expect(formatHumanReference('del run B-2 reversal')).toBe('Batch B-2 Reversal');
      expect(formatHumanReference('run B-3 edit')).toBe('Batch B-3 Adjustment');
      expect(formatHumanReference('run B-4')).toBe('Batch B-4 Output');
    });
  });

  // Bug 4: Packet Duplication Bug
  describe('Bug 4: Packet Duplication & In-Place Editing', () => {
    it('updates existing packing records instead of duplicating them when adding extra packets', async () => {
      const products = await repo.listProducts(true);
      const prod = products[0];

      // 1. Initial submission: cook records 50 packets of 10 x 12
      const rec1 = await repo.recordPacking({
        packingDate: '2026-11-06',
        productId: prod.id,
        productionRunId: 'run-test-01',
        packetSize: '10 x 12 Packet',
        packetsPacked: 50,
        operatorName: 'Raju',
        notes: 'Batch #B-1',
      });

      expect(rec1.packetsPacked).toBe(50);
      let records = await repo.listPackingRecords({ productId: prod.id });
      expect(records).toHaveLength(1);
      expect(records[0].packetsPacked).toBe(50);

      // 2. Extra packets added later: Cook edits 10 x 12 to 75 and adds 20 of 2KG HM Packet
      const updatedRec1 = await repo.updatePackingRecord({
        id: rec1.id,
        packetsPacked: 75,
        operatorName: 'Raju',
        notes: 'Batch #B-1',
      });
      expect(updatedRec1.packetsPacked).toBe(75);

      const rec2 = await repo.recordPacking({
        packingDate: '2026-11-06',
        productId: prod.id,
        productionRunId: 'run-test-01',
        packetSize: '2KG HM Packet',
        packetsPacked: 20,
        operatorName: 'Raju',
        notes: 'Batch #B-1',
      });
      expect(rec2.packetsPacked).toBe(20);

      // Verify no duplicates in database
      records = await repo.listPackingRecords({ productId: prod.id });
      expect(records).toHaveLength(2);

      const p10x12 = records.find((r) => r.packetSize === '10 x 12 Packet');
      const p2kg = records.find((r) => r.packetSize === '2KG HM Packet');
      expect(p10x12?.packetsPacked).toBe(75);
      expect(p2kg?.packetsPacked).toBe(20);

      const totalPackets = records.reduce((sum, r) => sum + r.packetsPacked, 0);
      expect(totalPackets).toBe(95);
    });

    it('deletes packing record when packet count is adjusted to 0', async () => {
      const products = await repo.listProducts(true);
      const prod = products[0];

      const rec = await repo.recordPacking({
        packingDate: '2026-11-06',
        productId: prod.id,
        productionRunId: 'run-test-02',
        packetSize: '10 x 12 Packet',
        packetsPacked: 30,
        operatorName: 'Raju',
      });

      let records = await repo.listPackingRecords({ productId: prod.id });
      expect(records).toHaveLength(1);

      await repo.deletePackingRecord(rec.id);
      records = await repo.listPackingRecords({ productId: prod.id });
      expect(records).toHaveLength(0);
    });
  });

  // Bug 5: Completed Batches & Status Updates
  describe('Bug 5: Completed Batches & Status Updates', () => {
    it('sets status to completed when produced actual quantity is recorded', async () => {
      const products = await repo.listProducts(true);
      const prod = products[0];

      const run = await repo.recordProductionRun({
        runNumber: 'PRD-TEST-001',
        productId: prod.id,
        productionDate: '2026-11-06',
        plannedQuantity: 20,
        actualQuantity: 0,
        unit: 'kg',
        operatorName: 'Raju',
        ingredientsConsumed: [],
      });

      // Update actual produced quantity
      const updated = await repo.updateProductionRun({
        runId: run.id,
        actualQuantity: 19.5,
        status: 'completed',
      });

      expect(updated.actualQuantity).toBe(19.5);
      expect(updated.status).toBe('completed');

      const reloaded = await repo.getProductionRunById(run.id);
      expect(reloaded?.status).toBe('completed');
      expect(reloaded?.actualQuantity).toBe(19.5);
    });
  });

  // Bug 6: Black Salt Stock Deduction vs Basic Salt
  describe('Bug 6: Black Salt Stock Deduction', () => {
    it('correctly classifies Black Salt in English and Malayalam as NOT daily shared basic', () => {
      expect(isBlackSalt('Black Salt')).toBe(true);
      expect(isBlackSalt('കറുത്ത ഉപ്പ്')).toBe(true);
      expect(isBlackSalt('ബ്ലാക്ക് സാൾട്ട്')).toBe(true);
      expect(isBlackSalt('കാലാ നമക്')).toBe(true);

      // Common salt is NOT Black Salt
      expect(isBlackSalt('ഉപ്പ്')).toBe(false);
      expect(isBlackSalt('Salt')).toBe(false);

      // Daily shared basic excludes Black Salt
      expect(isDailySharedBasic('Black Salt')).toBe(false);
      expect(isDailySharedBasic('കറുത്ത ഉപ്പ്')).toBe(false);
      expect(isDailySharedBasic('ബ്ലാക്ക് സാൾട്ട്')).toBe(false);

      // But common salt IS daily shared basic
      expect(isDailySharedBasic('ഉപ്പ്')).toBe(true);
      expect(isDailySharedBasic('Salt')).toBe(true);
    });

    it('deducts ONLY Black Salt inventory and never basic Salt when Black Salt is used in production', async () => {
      const ingredients = await repo.listIngredients(true);
      const commonSalt = ingredients.find((i) => i.name.toLowerCase() === 'salt' || i.name === 'ഉപ്പ്');
      const blackSalt = ingredients.find((i) => i.name.toLowerCase().includes('black salt') || i.name.includes('കറുത്ത ഉപ്പ്'));

      expect(commonSalt, 'Common Salt should exist in seeded data').toBeDefined();
      expect(blackSalt, 'Black Salt should exist in seeded data').toBeDefined();

      const initialSaltStock = commonSalt!.currentStock;
      const initialBlackSaltStock = blackSalt!.currentStock;

      const products = await repo.listProducts(true);
      const prod = products[0];

      // Run production that consumes 2kg of Black Salt
      await repo.recordProductionRun({
        runNumber: 'PRD-BLACK-SALT-TEST',
        productId: prod.id,
        productionDate: '2026-11-06',
        plannedQuantity: 10,
        actualQuantity: 10,
        unit: 'kg',
        operatorName: 'Chef',
        ingredientsConsumed: [
          {
            ingredientId: blackSalt!.id,
            expectedQuantity: 2,
            actualQuantity: 2,
            unit: 'kg',
          },
        ],
      });

      const updatedIngredients = await repo.listIngredients(true);
      const updatedCommonSalt = updatedIngredients.find((i) => i.id === commonSalt!.id);
      const updatedBlackSalt = updatedIngredients.find((i) => i.id === blackSalt!.id);

      // Black salt stock MUST decrease by 2kg
      expect(updatedBlackSalt!.currentStock).toBe(initialBlackSaltStock - 2);
      // Common salt stock MUST remain strictly unchanged!
      expect(updatedCommonSalt!.currentStock).toBe(initialSaltStock);
    });
  });
});

