export interface Employee {
  id: string; // Barcode ID
  name: string;
  email?: string;
  designation?: string;
  department?: string;
  baseSalary: number;
  hourlyOvertimeRate?: number;
  allowedLeaves: number; // Monthly quota
  perLeaveDeduction: number; // Amount to cut per extra leave
  shiftStart?: string; // HH:mm (e.g., "09:00")
  shiftEnd?: string; // HH:mm (e.g., "18:00")
  lateDeductionPerMinute?: number; // Amount to cut per minute late
  joiningDate?: string;
  status: 'active' | 'inactive';
}

export interface Leave {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  type: 'sick' | 'casual' | 'unpaid';
  createdAt: any;
}

export interface Attendance {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkIn: any; // Firestore Timestamp
  checkOut?: any; // Firestore Timestamp
  status: 'present' | 'absent' | 'late';
  lateMinutes?: number;
}

export interface Overtime {
  id?: string;
  employeeId: string;
  date: string;
  hours: number;
  approved: boolean;
}

export interface Payroll {
  id?: string;
  employeeId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  overtimePay: number;
  deductions: number;
  netSalary: number;
  status: 'pending' | 'paid';
}
