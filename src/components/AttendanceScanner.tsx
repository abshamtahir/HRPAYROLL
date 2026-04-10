import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db, isFirebaseConfigured } from '@/src/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, differenceInMinutes, parse } from 'date-fns';
import { dataService } from '@/src/services/dataService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { ScanBarcode, Keyboard, Fingerprint, History, Clock, LogIn, LogOut, Trash2 } from 'lucide-react';

export default function AttendanceScanner({ isDemo }: { isDemo?: boolean }) {
  const [scanning, setScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isDemo) return;
    
    const q = query(
      collection(db, 'attendance'),
      orderBy('checkIn', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    return () => unsubscribe();
  }, [isDemo]);

  const processAttendance = async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    const loadingToast = toast.loading(`Processing ID: ${cleanId}...`);
    
    // Safety timeout to prevent infinite "Processing" state
    const timeoutId = setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.error("Processing timed out. Please check your connection.");
    }, 8000);

    try {
      if (isDemo) {
        const result = await dataService.processAttendance(true, cleanId);
        clearTimeout(timeoutId);
        toast.dismiss(loadingToast);
        if (result?.type === 'check-in') toast.success(`Welcome ${result.name}! Checked in.`);
        else if (result?.type === 'check-out') toast.success(`Goodbye ${result.name}! Checked out.`);
        else if (result?.type === 'already-done') toast.info(`${result.name} already checked out.`);
        return;
      }

      if (!isFirebaseConfigured) {
        clearTimeout(timeoutId);
        toast.dismiss(loadingToast);
        toast.error("Firebase is not configured. Please use Demo Mode or set up Firebase.");
        return;
      }

      // Real Firebase logic
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('id', '==', cleanId), where('status', '==', 'active'));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'employees');
        return;
      }

      if (querySnapshot.empty) {
        clearTimeout(timeoutId);
        toast.dismiss(loadingToast);
        toast.error(`Employee with ID ${cleanId} not found or inactive.`);
        return;
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();

      const attendanceRef = collection(db, 'attendance');
      const attQ = query(attendanceRef, where('employeeId', '==', cleanId), where('date', '==', today));
      let attSnapshot;
      try {
        attSnapshot = await getDocs(attQ);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
        return;
      }

      if (attSnapshot.empty) {
        // Check-in logic with Late Calculation
        let lateMinutes = 0;
        let status: 'present' | 'late' = 'present';

        if (employeeData.shiftStart) {
          const shiftStartTime = parse(employeeData.shiftStart, 'HH:mm', now);
          if (now > shiftStartTime) {
            lateMinutes = differenceInMinutes(now, shiftStartTime);
            if (lateMinutes > 0) {
              status = 'late';
            }
          }
        }

        try {
          await addDoc(attendanceRef, {
            employeeId: cleanId,
            employeeName: employeeData.name,
            date: today,
            checkIn: serverTimestamp(),
            status: status,
            lateMinutes: lateMinutes
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'attendance');
        }
        clearTimeout(timeoutId);
        toast.dismiss(loadingToast);
        const lateMsg = status === 'late' ? ` (Late by ${lateMinutes} mins)` : '';
        toast.success(`Welcome ${employeeData.name}! Checked in at ${format(now, 'hh:mm a')}${lateMsg}`);
      } else {
        const attDoc = attSnapshot.docs[0];
        if (attDoc.data().checkOut) {
          clearTimeout(timeoutId);
          toast.dismiss(loadingToast);
          toast.info(`${employeeData.name} already checked out for today.`);
          return;
        }
        try {
          await updateDoc(doc(db, 'attendance', attDoc.id), {
            checkOut: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `attendance/${attDoc.id}`);
        }
        clearTimeout(timeoutId);
        toast.dismiss(loadingToast);
        toast.success(`Goodbye ${employeeData.name}! Checked out at ${format(new Date(), 'hh:mm a')}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      toast.dismiss(loadingToast);
      console.error("Attendance Error:", error);
      toast.error("Failed to process attendance. Please try again.");
    }
  };

  const handleScan = async (decodedText: string) => {
    await processAttendance(decodedText);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId) return;
    await processAttendance(manualId);
    setManualId('');
  };

  useEffect(() => {
    const startScanner = async () => {
      if (scanning) {
        try {
          // Give React a moment to render the #reader div
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          const config = { fps: 10, qrbox: { width: 250, height: 250 } };
          
          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
              handleScan(decodedText);
              // Optionally stop after one scan if needed, but here we keep it running
            },
            (errorMessage) => {
              // Ignore constant scanning errors
            }
          );
        } catch (err) {
          console.error("Scanner start error:", err);
          toast.error("Could not start camera. Please ensure camera permissions are granted.");
          setScanning(false);
        }
      } else {
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (err) {
            console.error("Scanner stop error:", err);
          }
          scannerRef.current = null;
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        const stopScanner = async () => {
          try {
            if (scannerRef.current?.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current?.clear();
          } catch (err) {
            console.error("Cleanup error:", err);
          }
        };
        stopScanner();
      }
    };
  }, [scanning]);

  const handleDeleteAttendance = async (logId: string) => {
    if (isDemo) {
      toast.error("Cannot delete demo data");
      return;
    }

    if (!confirm("Are you sure you want to delete this attendance record?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'attendance', logId));
      toast.success("Attendance record deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `attendance/${logId}`);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="w-full max-w-xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Attendance System</CardTitle>
          <CardDescription className="text-center">Select your preferred method to check in/out</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="barcode" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="barcode" className="gap-2">
                <ScanBarcode className="w-4 h-4" />
                Barcode
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Keyboard className="w-4 h-4" />
                Manual ID
              </TabsTrigger>
              <TabsTrigger value="fingerprint" className="gap-2">
                <Fingerprint className="w-4 h-4" />
                Fingerprint
              </TabsTrigger>
            </TabsList>

            <TabsContent value="barcode" className="space-y-4">
              <div id="reader" className="w-full min-h-[300px] border-2 border-dashed rounded-xl flex items-center justify-center bg-muted overflow-hidden">
                {!scanning && <p className="text-muted-foreground">Scanner is off</p>}
              </div>
              <Button 
                onClick={() => setScanning(!scanning)} 
                variant={scanning ? "destructive" : "default"}
                className="w-full py-6 text-lg"
              >
                {scanning ? "Stop Camera" : "Start Barcode Scanner"}
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-6 py-4">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manualId">Enter Employee Barcode ID</Label>
                  <Input 
                    id="manualId" 
                    placeholder="e.g. EMP001" 
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="py-6 text-lg"
                  />
                </div>
                <Button type="submit" className="w-full py-6 text-lg">
                  Process Attendance
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="fingerprint" className="space-y-6 py-8 text-center">
              <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <Fingerprint className="w-12 h-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Fingerprint Simulation</h3>
                <p className="text-sm text-muted-foreground">
                  In a real environment, this would connect to a USB Fingerprint Reader.
                  For this demo, please use the Manual ID or Barcode method.
                </p>
              </div>
              <Button variant="outline" className="w-full py-6" disabled>
                Waiting for Sensor...
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent Activity Section */}
      <Card className="w-full max-w-4xl mx-auto shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Recent Attendance Activity
            </CardTitle>
            <CardDescription>Real-time updates of employee check-ins and check-outs</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No recent activity found.
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">{log.employeeName || 'Unknown'}</TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                        <LogIn className="w-3 h-3" />
                        {log.checkIn ? format(log.checkIn.toDate(), 'hh:mm:ss a') : '--'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-orange-600 font-medium">
                        <LogOut className="w-3 h-3" />
                        {log.checkOut ? format(log.checkOut.toDate(), 'hh:mm:ss a') : '--'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'late' ? 'destructive' : log.checkOut ? "secondary" : "default"} className="gap-1">
                        <Clock className="w-3 h-3" />
                        {log.status === 'late' ? `Late (${log.lateMinutes}m)` : log.checkOut ? "Shift Ended" : "On Duty"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteAttendance(log.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
