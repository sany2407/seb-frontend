export type PaymentStatus = "Paid" | "Pending" | "Partial" | "Overdue";
export type SplitMethod = "usage" | "equal" | "percentage";
export type MeterType = "MAIN" | "SUB";

export interface Home {
  id: string;
  name: string;
  occupant: string;
  meterNo: string;
  meterType: MeterType;
  active: boolean;
  notes?: string;
  color: string;
}

export interface MonthlySplit {
  homeId: string | "COMMON";
  homeName: string;
  units: number;
  percent: number;
  amount: number;
}

export interface EBBill {
  id: string;
  month: string; // "Oct 2026"
  monthKey: string; // "2026-10"
  billNo: string;
  mainPrev: number;
  mainCurr: number;
  mainUnits: number;
  amount: number;
  billDate: string;
  dueDate: string;
  status: PaymentStatus;
  paid: number;
  method: SplitMethod;
  percentages?: Record<string, number>;
  splits: MonthlySplit[];
  commonUnits: number;
  commonAmount: number;
  subUnits: number;
  paymentMethod?: string;
  notes?: string;
  attachmentCount: number;
}

export interface Reading {
  id: string;
  monthKey: string;
  month: string;
  homeId: string;
  homeName: string;
  prev: number;
  curr: number;
  units: number;
  photoCount: number;
  notes?: string;
  isMain?: boolean;
}
