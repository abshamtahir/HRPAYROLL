import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, addDoc, serverTimestamp, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { Employee, Attendance, Payroll, Leave } from '@/src/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Search, Copy, Edit, Calendar, CheckCircle } from 'lucide-react';
import { dataService } from '@/src/services/dataService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { getDocFromServer } from 'firebase/firestore';

export default function PayrollManagement({ isDemo }: { isDemo?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    async function testConnection() {
      if (isDemo) return;
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    if (isDemo) {
      dataService.getEmployees(true).then(setEmployees);
      setLoading(false);
      return;
    }

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id } as Employee & { firestoreId: string }));
      setEmployees(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attendance));
      setAttendance(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    const unsubLeaves = onSnapshot(collection(db, 'leaves'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Leave));
      setLeaves(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaves');
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
    };
  }, []);

  const calculatePayroll = async (employee: Employee & { firestoreId?: string }) => {
    try {
      if (isDemo) {
        await dataService.generatePayroll(true, employee);
        toast.success(`Payroll generated for ${employee.name} (Demo)`);
        return;
      }

      const currentMonth = format(new Date(), 'yyyy-MM');
      
      const payrollRef = collection(db, 'payroll');
      const q = query(payrollRef, where('employeeId', '==', employee.id), where('month', '==', currentMonth));
      let existing;
      try {
        existing = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'payroll');
        return;
      }

      if (!existing.empty) {
        toast.info(`Payroll for ${employee.name} for ${currentMonth} already generated.`);
        return;
      }

      // 1. Calculate Overtime and Late Deductions
      const monthAttendance = attendance.filter(a => 
        a.employeeId === employee.id && 
        a.date.startsWith(currentMonth) && 
        a.checkIn
      );

      let totalOvertimeHours = 0;
      let totalLateMinutes = 0;

      monthAttendance.forEach(att => {
        // Overtime calculation
        if (att.checkIn && att.checkOut) {
          const checkIn = att.checkIn.toDate();
          const checkOut = att.checkOut.toDate();
          const hoursWorked = differenceInHours(checkOut, checkIn);
          if (hoursWorked > 8) {
            totalOvertimeHours += (hoursWorked - 8);
          }
        }

        // Late minutes calculation (from attendance record)
        if (att.lateMinutes) {
          totalLateMinutes += att.lateMinutes;
        }
      });

      const overtimePay = totalOvertimeHours * (employee.hourlyOvertimeRate || 0);
      const lateDeduction = totalLateMinutes * (employee.lateDeductionPerMinute || 0);

      // 2. Calculate Leave Deductions
      const monthLeaves = leaves.filter(l => 
        l.employeeId === employee.id && 
        l.date.startsWith(currentMonth)
      );

      const extraLeaves = Math.max(0, monthLeaves.length - (employee.allowedLeaves || 0));
      const leaveDeduction = extraLeaves * (employee.perLeaveDeduction || 0);

      const totalDeductions = leaveDeduction + lateDeduction;
      const netSalary = employee.baseSalary + overtimePay - totalDeductions;

      try {
        await addDoc(payrollRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          month: currentMonth,
          baseSalary: employee.baseSalary,
          overtimeHours: totalOvertimeHours,
          overtimePay: overtimePay,
          extraLeaves: extraLeaves,
          lateMinutes: totalLateMinutes,
          lateDeduction: lateDeduction,
          leaveDeduction: leaveDeduction,
          deductions: totalDeductions,
          netSalary: netSalary,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'payroll');
      }

      toast.success(`Payroll generated for ${employee.name}. Deductions: Rs. ${totalDeductions} (Leaves: ${leaveDeduction}, Late: ${lateDeduction})`);
    } catch (error) {
      console.error("Payroll Error:", error);
      toast.error("Failed to generate payroll.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Management</h2>
        <AddEmployeeDialog />
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">Employee Management</TabsTrigger>
          <TabsTrigger value="leaves">Leave Management</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Records</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Employees & Overtime Tracking</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Base Salary (PKR)</TableHead>
                    <TableHead>Leaves (Quota/Cut)</TableHead>
                    <TableHead>Shift (Start/End)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono font-bold text-primary">
                        <div className="flex items-center gap-2">
                          {emp.id}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => {
                              navigator.clipboard.writeText(emp.id);
                              toast.success("ID copied to clipboard");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell>Rs. {emp.baseSalary}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {emp.allowedLeaves || 0} / Rs. {emp.perLeaveDeduction || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {emp.shiftStart || '09:00'} - {emp.shiftEnd || '18:00'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <EditEmployeeDialog employee={emp} />
                        <Button size="sm" onClick={() => calculatePayroll(emp)}>
                          Payroll
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <LeaveManagement isDemo={isDemo} employees={employees} />
        </TabsContent>

        <TabsContent value="payroll">
          <PayrollList isDemo={isDemo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    designation: '',
    department: '',
    baseSalary: '',
    hourlyOvertimeRate: '',
    allowedLeaves: '2',
    perLeaveDeduction: '500',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    lateDeductionPerMinute: '10',
    status: 'active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'employees'), {
        ...formData,
        baseSalary: Number(formData.baseSalary),
        hourlyOvertimeRate: Number(formData.hourlyOvertimeRate),
        allowedLeaves: Number(formData.allowedLeaves),
        perLeaveDeduction: Number(formData.perLeaveDeduction),
        lateDeductionPerMinute: Number(formData.lateDeductionPerMinute),
        createdAt: serverTimestamp()
      });
      toast.success("Employee added successfully");
      setOpen(false);
      setFormData({ 
        id: '', name: '', designation: '', department: '', baseSalary: '', 
        hourlyOvertimeRate: '', allowedLeaves: '2', perLeaveDeduction: '500', 
        shiftStart: '09:00', shiftEnd: '18:00', lateDeductionPerMinute: '10',
        status: 'active' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employees');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="w-4 h-4" />
        Add Employee
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Employee Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">Barcode ID</Label>
              <Input id="id" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="EMP001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary">Base Salary (PKR)</Label>
              <Input id="salary" type="number" value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot">OT Rate (PKR/hr)</Label>
              <Input id="ot" type="number" value={formData.hourlyOvertimeRate} onChange={e => setFormData({...formData, hourlyOvertimeRate: e.target.value})} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="allowedLeaves">Monthly Allowed Leaves</Label>
              <Input id="allowedLeaves" type="number" value={formData.allowedLeaves} onChange={e => setFormData({...formData, allowedLeaves: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perLeaveDeduction">Deduction per Extra Leave</Label>
              <Input id="perLeaveDeduction" type="number" value={formData.perLeaveDeduction} onChange={e => setFormData({...formData, perLeaveDeduction: e.target.value})} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shiftStart">Shift Start</Label>
              <Input id="shiftStart" type="time" value={formData.shiftStart} onChange={e => setFormData({...formData, shiftStart: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shiftEnd">Shift End</Label>
              <Input id="shiftEnd" type="time" value={formData.shiftEnd} onChange={e => setFormData({...formData, shiftEnd: e.target.value})} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lateDeduction">Late Deduction (PKR per minute)</Label>
            <Input id="lateDeduction" type="number" value={formData.lateDeductionPerMinute} onChange={e => setFormData({...formData, lateDeductionPerMinute: e.target.value})} required />
          </div>
          <Button type="submit" className="w-full">Save Employee</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ employee }: { employee: any }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: employee.name,
    designation: employee.designation || '',
    department: employee.department || '',
    baseSalary: String(employee.baseSalary),
    hourlyOvertimeRate: String(employee.hourlyOvertimeRate || ''),
    allowedLeaves: String(employee.allowedLeaves || 2),
    perLeaveDeduction: String(employee.perLeaveDeduction || 500),
    shiftStart: employee.shiftStart || '09:00',
    shiftEnd: employee.shiftEnd || '18:00',
    lateDeductionPerMinute: String(employee.lateDeductionPerMinute || 10),
    status: employee.status
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!employee.firestoreId) {
        toast.error("Cannot edit demo data");
        return;
      }
      await updateDoc(doc(db, 'employees', employee.firestoreId), {
        ...formData,
        baseSalary: Number(formData.baseSalary),
        hourlyOvertimeRate: Number(formData.hourlyOvertimeRate),
        allowedLeaves: Number(formData.allowedLeaves),
        perLeaveDeduction: Number(formData.perLeaveDeduction),
        lateDeductionPerMinute: Number(formData.lateDeductionPerMinute)
      });
      toast.success("Employee updated successfully");
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `employees/${employee.firestoreId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Edit className="w-3 h-3" />
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Employee: {employee.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input id="edit-designation" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-salary">Base Salary (PKR)</Label>
              <Input id="edit-salary" type="number" value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ot">OT Rate (PKR/hr)</Label>
              <Input id="edit-ot" type="number" value={formData.hourlyOvertimeRate} onChange={e => setFormData({...formData, hourlyOvertimeRate: e.target.value})} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-allowedLeaves">Monthly Allowed Leaves</Label>
              <Input id="edit-allowedLeaves" type="number" value={formData.allowedLeaves} onChange={e => setFormData({...formData, allowedLeaves: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-perLeaveDeduction">Deduction per Extra Leave</Label>
              <Input id="edit-perLeaveDeduction" type="number" value={formData.perLeaveDeduction} onChange={e => setFormData({...formData, perLeaveDeduction: e.target.value})} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-shiftStart">Shift Start</Label>
              <Input id="edit-shiftStart" type="time" value={formData.shiftStart} onChange={e => setFormData({...formData, shiftStart: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-shiftEnd">Shift End</Label>
              <Input id="edit-shiftEnd" type="time" value={formData.shiftEnd} onChange={e => setFormData({...formData, shiftEnd: e.target.value})} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-lateDeduction">Late Deduction (PKR per minute)</Label>
            <Input id="edit-lateDeduction" type="number" value={formData.lateDeductionPerMinute} onChange={e => setFormData({...formData, lateDeductionPerMinute: e.target.value})} required />
          </div>
          <Button type="submit" className="w-full">Update Employee</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveManagement({ isDemo, employees }: { isDemo?: boolean, employees: Employee[] }) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'unpaid' as any,
    reason: ''
  });

  useEffect(() => {
    if (isDemo) return;
    const unsub = onSnapshot(collection(db, 'leaves'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Leave));
      setLeaves(data);
    });
    return unsub;
  }, [isDemo]);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) {
      toast.error("Employee not found");
      return;
    }

    try {
      await addDoc(collection(db, 'leaves'), {
        ...formData,
        employeeName: emp.name,
        createdAt: serverTimestamp()
      });
      toast.success("Leave recorded successfully");
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leaves');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leave Tracking</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Calendar className="w-4 h-4" />
            Add Leave Record
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Employee Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddLeave} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Employee</Label>
                <Select value={formData.employeeId} onValueChange={v => setFormData({...formData, employeeId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Optional reason..." />
              </div>
              <Button type="submit" className="w-full">Save Leave</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No leave records found.</TableCell></TableRow>
            ) : (
              leaves.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.employeeName}</TableCell>
                  <TableCell>{l.date}</TableCell>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell className="text-sm">{l.reason || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayrollList({ isDemo }: { isDemo?: boolean }) {
  const [payrolls, setPayrolls] = useState<any[]>([]);

  useEffect(() => {
    if (isDemo) {
      const interval = setInterval(() => {
        dataService.getPayrolls(true).then(setPayrolls);
      }, 1000);
      return () => clearInterval(interval);
    }

    const unsub = onSnapshot(collection(db, 'payroll'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setPayrolls(data);
    });
    return unsub;
  }, []);

  const handleUpdateStatus = async (payrollId: string, currentStatus: string) => {
    if (isDemo) {
      toast.error("Cannot update demo data");
      return;
    }

    const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
    try {
      await updateDoc(doc(db, 'payroll', payrollId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Payroll status updated to ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payroll/${payrollId}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Payroll Statements</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>OT Hours</TableHead>
              <TableHead>OT Pay (PKR)</TableHead>
              <TableHead>Deductions (Leaves)</TableHead>
              <TableHead>Net Salary (PKR)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrolls.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.employeeName}</TableCell>
                <TableCell>{p.month}</TableCell>
                <TableCell>{p.overtimeHours}h</TableCell>
                <TableCell>Rs. {p.overtimePay}</TableCell>
                <TableCell className="text-destructive">
                  {p.extraLeaves > 0 ? `Rs. ${p.deductions} (${p.extraLeaves} extra)` : '-'}
                </TableCell>
                <TableCell className="font-bold">Rs. {p.netSalary}</TableCell>
                <TableCell>
                  <Badge variant={p.status === 'paid' ? 'default' : 'outline'}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`gap-2 ${p.status === 'pending' ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => handleUpdateStatus(p.id, p.status)}
                  >
                    {p.status === 'pending' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Mark as Paid
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4" />
                        Mark as Pending
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
