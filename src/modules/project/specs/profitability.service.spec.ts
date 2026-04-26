import { ProfitabilityService } from '../profitability.service';

describe('ProfitabilityService', () => {
  let service: ProfitabilityService;

  beforeEach(() => {
    service = new ProfitabilityService();
  });

  describe('compute', () => {
    it('should return GREEN colorBand when grossMargin > 20%', () => {
      const result = service.compute(500000, 7, [
        { lineTotal: 100000, vatIncluded: false },
      ]);

      expect(result.colorBand).toBe('GREEN');
      expect(result.grossMargin).toBeGreaterThan(20);
    });

    it('should return ORANGE colorBand when grossMargin is exactly 20%', () => {
      // totalRevenueNet = 500000 / 1.07 ≈ 467289.72
      // to achieve exactly 20% grossMargin: totalCostNet = 80% of totalRevenueNet
      const revenue = 500000;
      const vatRate = 7;
      const totalRevenueNet = revenue / (1 + vatRate / 100);
      const targetCostNet = totalRevenueNet * 0.8;

      const result = service.compute(revenue, vatRate, [
        { lineTotal: targetCostNet, vatIncluded: false },
      ]);

      expect(result.colorBand).toBe('ORANGE');
      expect(result.grossMargin).toBeCloseTo(20, 0);
    });

    it('should return ORANGE colorBand when grossMargin is exactly 10%', () => {
      const revenue = 500000;
      const vatRate = 7;
      const totalRevenueNet = revenue / (1 + vatRate / 100);
      const targetCostNet = totalRevenueNet * 0.9;

      const result = service.compute(revenue, vatRate, [
        { lineTotal: targetCostNet, vatIncluded: false },
      ]);

      expect(result.colorBand).toBe('ORANGE');
      expect(result.grossMargin).toBeCloseTo(10, 0);
    });

    it('should return RED colorBand when grossMargin is 9.9%', () => {
      const revenue = 500000;
      const vatRate = 7;
      const totalRevenueNet = revenue / (1 + vatRate / 100);
      const targetCostNet = totalRevenueNet * 0.901;

      const result = service.compute(revenue, vatRate, [
        { lineTotal: targetCostNet, vatIncluded: false },
      ]);

      expect(result.colorBand).toBe('RED');
    });

    it('should return RED colorBand when grossMargin is negative', () => {
      const result = service.compute(100000, 7, [
        { lineTotal: 200000, vatIncluded: false },
      ]);

      expect(result.colorBand).toBe('RED');
      expect(result.grossProfit).toBeLessThan(0);
    });

    it('should return RED with grossMargin 0 when revenue is zero', () => {
      const result = service.compute(0, 7, []);

      expect(result.colorBand).toBe('RED');
      expect(result.grossMargin).toBe(0);
    });

    it('should correctly net VAT-included items', () => {
      const revenue = 500000;
      const vatRate = 7;
      const vatFactor = 1 + vatRate / 100;
      const rawCost = 100000;
      const expectedNetCost = rawCost / vatFactor;

      const result = service.compute(revenue, vatRate, [
        { lineTotal: rawCost, vatIncluded: true },
      ]);

      expect(result.totalCostNet).toBeCloseTo(expectedNetCost, 1);
    });

    it('should not net VAT for non-VAT-included items', () => {
      const revenue = 500000;
      const vatRate = 7;

      const result = service.compute(revenue, vatRate, [
        { lineTotal: 100000, vatIncluded: false },
      ]);

      expect(result.totalCostNet).toBe(100000);
    });
  });
});
