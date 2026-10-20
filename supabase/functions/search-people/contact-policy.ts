export function contactCharge(unlimited: boolean, costs: number[]): number {
  return unlimited ? 0 : costs.reduce((total, cost) => total + cost, 0);
}

export function canLookupContact(unlimited: boolean, balance: number, maxCost: number): boolean {
  return unlimited || balance >= maxCost;
}