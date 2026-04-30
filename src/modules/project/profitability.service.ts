import { Injectable } from '@nestjs/common';

export type ColorBand = 'GREEN' | 'ORANGE' | 'RED';

export interface ProfitabilityResult {
  totalRevenueNet: number;
  totalCostNet: number;
  grossProfit: number;
  grossMargin: number;
  colorBand: ColorBand;
}

interface CostItemInput {
  lineTotal: number;
  vatIncluded: boolean;
}

@Injectable()
export class ProfitabilityService {
  compute(
    totalProjectPrice: number,
    vatRate: number,
    costItems: CostItemInput[],
  ): ProfitabilityResult {
    if (totalProjectPrice === 0) {
      return {
        totalRevenueNet: 0,
        totalCostNet: 0,
        grossProfit: 0,
        grossMargin: 0,
        colorBand: 'RED',
      };
    }

    const vatFactor = 1 + vatRate / 100;
    const totalRevenueNet = totalProjectPrice / vatFactor;

    const totalCostNet = costItems.reduce((sum, item) => {
      const netCost = item.vatIncluded
        ? item.lineTotal / vatFactor
        : item.lineTotal;
      return sum + netCost;
    }, 0);

    const grossProfit = totalRevenueNet - totalCostNet;
    const grossMargin = (grossProfit / totalRevenueNet) * 100;
    const colorBand = this.resolveColorBand(grossMargin);

    return {
      totalRevenueNet: Math.round(totalRevenueNet * 100) / 100,
      totalCostNet: Math.round(totalCostNet * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      colorBand,
    };
  }

  private resolveColorBand(grossMargin: number): ColorBand {
    if (grossMargin > 20) return 'GREEN';
    if (grossMargin >= 10) return 'ORANGE';
    return 'RED';
  }
}
