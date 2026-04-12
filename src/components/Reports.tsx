import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Download, FileSpreadsheet } from 'lucide-react';

export default function Reports({ isDemo }: { isDemo?: boolean }) {
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceMonth, setAttendanceMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendanceReportType, setAttendanceReportType] = useState<'daily' | 'monthly'>('daily');
  
  const [payrollMonth, setPayrollMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isExporting, setIsExporting] = useState(false);

  const exportAttendance = async () => {
    setIsExporting(true);
    try {
      let data: any[] = [];
      
      if (isDemo) {
        toast.error("Detailed reports are limited in Demo Mode. Please configure Firebase.");
        setIsExporting(false);
        return;
      }

      const attendanceRef = collection(db, 'attendance');
      let q;
      
      if (attendanceReportType === 'daily') {
        q = query(attendanceRef, where('date', '==', attendanceDate));
      } else {
        q = query(
          attendanceRef, 
          where('date', '>=', `${attendanceMonth}-01`),
          where('date', '<=', `${attendanceMonth}-31`)
        );
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.info("No attendance records found for the selected period.");
        setIsExporting(false);
        return;
      }

      data = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          'Employee ID': d.employeeId,
          'Employee Name': d.employeeName,
          'Date': d.date,
          'Check In': d.checkIn ? format(d.checkIn.toDate(), 'hh:mm a') : '-',
          'Check Out': d.checkOut ? format(d.checkOut.toDate(), 'hh:mm a') : '-',
          'Status': d.status,
          'Late Minutes': d.lateMinutes || 0
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
      
      const fileName = `Attendance_Report_${attendanceReportType === 'daily' ? attendanceDate : attendanceMonth}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Attendance report exported successfully!");

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export attendance report.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPayroll = async () => {
    setIsExporting(true);
    try {
      if (isDemo) {
        toast.error("Detailed reports are limited in Demo Mode. Please configure Firebase.");
        setIsExporting(false);
        return;
      }

      const payrollRef = collection(db, 'payroll');
      const q = query(payrollRef, where('month', '==', payrollMonth));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.info(`No payroll records found for ${payrollMonth}.`);
        setIsExporting(false);
        return;
      }

      const data = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          'Employee ID': d.employeeId,
          'Employee Name': d.employeeName,
          'Month': d.month,
          'Base Salary (PKR)': d.baseSalary,
          'OT Hours': d.overtimeHours || 0,
          'OT Pay (PKR)': d.overtimePay || 0,
          'Late Mins': d.lateMinutes || 0,
          'Late Deduction (PKR)': d.lateDeduction || 0,
          'Extra Leaves': d.extraLeaves || 0,
          'Leave Deduction (PKR)': d.leaveDeduction || 0,
          'Total Deductions (PKR)': d.deductions || 0,
          'Net Salary (PKR)': d.netSalary,
          'Status': d.status
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
      
      XLSX.writeFile(workbook, `Payroll_Report_${payrollMonth}.xlsx`);
      toast.success("Payroll report exported successfully!");

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export payroll report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="attendance">Attendance Reports</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Export Attendance Data
              </CardTitle>
              <CardDescription>Download daily or monthly attendance records in Excel format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant={attendanceReportType === 'daily' ? 'default' : 'outline'} 
                  onClick={() => setAttendanceReportType('daily')}
                >
                  Daily Report
                </Button>
                <Button 
                  variant={attendanceReportType === 'monthly' ? 'default' : 'outline'} 
                  onClick={() => setAttendanceReportType('monthly')}
                >
                  Monthly Report
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {attendanceReportType === 'daily' ? (
                  <div className="space-y-2">
                    <Label>Select Date</Label>
                    <Input 
                      type="date" 
                      value={attendanceDate} 
                      onChange={(e) => setAttendanceDate(e.target.value)} 
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Select Month</Label>
                    <Input 
                      type="month" 
                      value={attendanceMonth} 
                      onChange={(e) => setAttendanceMonth(e.target.value)} 
                    />
                  </div>
                )}
                
                <Button 
                  onClick={exportAttendance} 
                  disabled={isExporting}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exporting...' : 'Download Excel'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Export Payroll Data
              </CardTitle>
              <CardDescription>Download monthly payroll statements and deductions in Excel format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Select Month</Label>
                  <Input 
                    type="month" 
                    value={payrollMonth} 
                    onChange={(e) => setPayrollMonth(e.target.value)} 
                  />
                </div>
                
                <Button 
                  onClick={exportPayroll} 
                  disabled={isExporting}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exporting...' : 'Download Excel'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
