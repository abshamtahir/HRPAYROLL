import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '@/src/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import AttendanceScanner from './components/AttendanceScanner';
import PayrollManagement from './components/PayrollManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Toaster } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  ScanBarcode, 
  Banknote, 
  LogOut, 
  LogIn,
  TrendingUp,
  Clock,
  Settings,
  AlertCircle,
  Play,
  Lock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

export default function App() {
  const [isDemo, setIsDemo] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    totalPayroll: 0,
    pendingPayrollsCount: 0
  });

  useEffect(() => {
    if (isFirebaseConfigured) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');

      const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
        setStats(prev => ({ ...prev, totalEmployees: snap.size }));
      });

      const qAttendance = query(collection(db, 'attendance'), where('date', '==', today));
      const unsubAttendance = onSnapshot(qAttendance, (snap) => {
        setStats(prev => ({ ...prev, presentToday: snap.size }));
      });

      const qPayroll = query(collection(db, 'payroll'), where('month', '==', currentMonth));
      const unsubPayroll = onSnapshot(qPayroll, (snap) => {
        const total = snap.docs.reduce((acc, doc) => acc + (doc.data().netSalary || 0), 0);
        const pending = snap.docs.filter(doc => doc.data().status === 'pending').length;
        setStats(prev => ({ ...prev, totalPayroll: total, pendingPayrollsCount: pending }));
      });

      return () => {
        unsubEmployees();
        unsubAttendance();
        unsubPayroll();
      };
    } else if (isDemo) {
      setStats({ totalEmployees: 3, presentToday: 2, totalPayroll: 13500 });
    }
  }, [isDemo]);

  if (!isAuthenticated && !isDemo) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} onDemo={() => setIsDemo(true)} />;
  }

  if (!isFirebaseConfigured && !isDemo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-orange-500">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Settings className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">System Setup Required</CardTitle>
            <CardDescription>
              Firebase setup is pending. You can either configure it or try the Demo Mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white border rounded-xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  Option 1: Real Mode
                </h3>
                <p className="text-sm text-muted-foreground">Click <strong>Settings</strong> in AI Studio and provide your Firebase API Key and Project ID.</p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  Option 2: Demo Mode
                </h3>
                <p className="text-sm text-muted-foreground">Use the system immediately with sample data. No setup required.</p>
                <Button onClick={() => setIsDemo(true)} className="w-full gap-2">
                  Launch Demo Mode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="p-6 border-bottom flex items-center gap-2">
          <Banknote className="w-6 h-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">Alla Processing</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<ScanBarcode />} 
            label="Attendance" 
            active={activeTab === 'attendance'} 
            onClick={() => setActiveTab('attendance')} 
          />
          <NavItem 
            icon={<Users />} 
            label="HR & Payroll" 
            active={activeTab === 'payroll'} 
            onClick={() => setActiveTab('payroll')} 
          />
        </nav>

        <div className="p-4 border-t space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-muted-foreground truncate">admin@allaprocessing.com</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setIsDemo(false); setIsAuthenticated(false); }}>
            <LogOut className="w-4 h-4" />
            {isDemo ? 'Exit Demo' : 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 md:hidden">
           <span className="font-bold text-xl">Alla Processing</span>
           <Button variant="ghost" size="icon" onClick={() => { setIsDemo(false); setIsAuthenticated(false); }}><LogOut className="w-5 h-5" /></Button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {isDemo && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
                <Play className="w-4 h-4" />
                Demo Mode Active: Using sample data.
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsDemo(false)}>Switch to Real Mode</Button>
            </div>
          )}
          {activeTab === 'dashboard' && <Dashboard stats={stats} />}
          {activeTab === 'attendance' && <AttendanceScanner isDemo={isDemo} />}
          {activeTab === 'payroll' && <PayrollManagement isDemo={isDemo} />}
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, onDemo }: { onLogin: () => void, onDemo: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'abshamtahir' && password === 'absham1') {
      onLogin();
      toast.success("Login successful!");
    } else {
      toast.error("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Alla Processing</CardTitle>
          <CardDescription>Enter your credentials to access the portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="Enter username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full py-6 text-lg">Login</Button>
          </form>
          <div className="mt-6 pt-6 border-t text-center">
            <Button variant="ghost" onClick={onDemo} className="text-muted-foreground hover:text-primary">
              Try Demo Mode
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-primary text-primary-foreground shadow-md' 
          : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
      }`}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
    </button>
  );
}

function Dashboard({ stats }: any) {
  const data = [
    { name: 'Jan', payroll: 4000 },
    { name: 'Feb', payroll: 3000 },
    { name: 'Mar', payroll: 2000 },
    { name: 'Apr', payroll: 2780 },
    { name: 'May', payroll: 1890 },
    { name: 'Jun', payroll: 2390 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground">Here's what's happening with your workforce today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          icon={<Users className="text-blue-500" />} 
          trend="+2 this month" 
        />
        <StatCard 
          title="Present Today" 
          value={stats.presentToday} 
          icon={<Clock className="text-green-500" />} 
          trend={stats.presentToday >= stats.totalEmployees && stats.totalEmployees > 0 ? "Attendance Complete" : "Attendance in progress"} 
          trendColor={stats.presentToday >= stats.totalEmployees && stats.totalEmployees > 0 ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50"}
        />
        <StatCard 
          title="Monthly Payroll" 
          value={`Rs. ${stats.totalPayroll.toLocaleString()}`} 
          icon={<TrendingUp className="text-orange-500" />} 
          trend={stats.totalPayroll > 0 && stats.pendingPayrollsCount === 0 ? "All Paid" : stats.totalPayroll > 0 ? `${stats.pendingPayrollsCount} Pending` : "No payroll generated"} 
          trendColor={stats.totalPayroll > 0 && stats.pendingPayrollsCount === 0 ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Payroll Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="payroll" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Overtime Analysis</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="payroll" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendColor }: any) {
  return (
    <Card className="shadow-sm border-none bg-white">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            {React.cloneElement(icon, { size: 24 })}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex items-center gap-2">
           <span className={`text-xs font-medium px-2 py-1 rounded-full ${trendColor || 'text-green-600 bg-green-50'}`}>
             {trend}
           </span>
        </div>
      </CardContent>
    </Card>
  );
}
