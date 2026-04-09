import { Employee, Attendance, Payroll } from '../types';
import { format, differenceInHours } from 'date-fns';

// Mock Data
const MOCK_EMPLOYEES: Employee[] = [
  { id: '123456', name: 'Ali Khan', designation: 'Software Engineer', department: 'IT', baseSalary: 5000, hourlyOvertimeRate: 25, allowedLeaves: 2, perLeaveDeduction: 200, status: 'active' },
  { id: '789012', name: 'Sara Ahmed', designation: 'HR Manager', department: 'HR', baseSalary: 4500, hourlyOvertimeRate: 20, allowedLeaves: 2, perLeaveDeduction: 150, status: 'active' },
  { id: '345678', name: 'Zainab Bibi', designation: 'Accountant', department: 'Finance', baseSalary: 4000, hourlyOvertimeRate: 15, allowedLeaves: 2, perLeaveDeduction: 100, status: 'active' },
];

let mockAttendance: Attendance[] = [];
let mockPayrolls: any[] = [];

export const dataService = {
  getEmployees: async (isDemo: boolean) => {
    if (isDemo) return MOCK_EMPLOYEES;
    // Real Firebase logic would go here
    return [];
  },

  processAttendance: async (isDemo: boolean, barcode: string) => {
    if (isDemo) {
      const emp = MOCK_EMPLOYEES.find(e => e.id === barcode);
      if (!emp) throw new Error("Employee not found");
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const existing = mockAttendance.find(a => a.employeeId === barcode && a.date === today);
      
      if (!existing) {
        mockAttendance.push({
          employeeId: barcode,
          date: today,
          checkIn: { toDate: () => new Date() },
          status: 'present'
        });
        return { type: 'check-in', name: emp.name };
      } else if (!existing.checkOut) {
        existing.checkOut = { toDate: () => new Date() };
        return { type: 'check-out', name: emp.name };
      }
      return { type: 'already-done', name: emp.name };
    }
    return null;
  },

  generatePayroll: async (isDemo: boolean, employee: Employee) => {
    if (isDemo) {
      const month = format(new Date(), 'yyyy-MM');
      const otHours = Math.floor(Math.random() * 10); // Random OT for demo
      const otPay = otHours * (employee.hourlyOvertimeRate || 0);
      const net = employee.baseSalary + otPay;

      const newPayroll = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: employee.id,
        employeeName: employee.name,
        month,
        baseSalary: employee.baseSalary,
        overtimeHours: otHours,
        overtimePay: otPay,
        netSalary: net,
        status: 'pending'
      };
      mockPayrolls.push(newPayroll);
      return newPayroll;
    }
    return null;
  },

  getPayrolls: async (isDemo: boolean) => {
    return isDemo ? mockPayrolls : [];
  }
};
