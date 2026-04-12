import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Palette, RotateCcw } from 'lucide-react';

const defaultTheme = {
  primary: '#6d28d9', // Indigo
  primaryForeground: '#ffffff',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  sidebar: '#ffffff'
};

export default function Settings() {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem('custom-theme');
    if (saved) {
      try {
        setTheme(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse theme", e);
      }
    }
  }, []);

  const handleColorChange = (key: keyof typeof defaultTheme, value: string) => {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (t: typeof defaultTheme) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--primary-foreground', t.primaryForeground);
    root.style.setProperty('--background', t.background);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--foreground', t.text);
    root.style.setProperty('--sidebar', t.sidebar);
    root.style.setProperty('--ring', t.primary);
    localStorage.setItem('custom-theme', JSON.stringify(t));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-foreground');
    root.style.removeProperty('--background');
    root.style.removeProperty('--card');
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--sidebar');
    root.style.removeProperty('--ring');
    localStorage.removeItem('custom-theme');
    toast.success('Theme reset to default');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Color Scheme Customizer
          </CardTitle>
          <CardDescription>
            Customize the application's colors to match your brand. Changes are applied instantly and saved to your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <Label>Primary Color (Buttons, Highlights)</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.primary} 
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Primary Text Color (Text inside buttons)</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.primaryForeground} 
                  onChange={(e) => handleColorChange('primaryForeground', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.primaryForeground}
                  onChange={(e) => handleColorChange('primaryForeground', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.background} 
                  onChange={(e) => handleColorChange('background', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.background}
                  onChange={(e) => handleColorChange('background', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Card & Panel Color</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.card} 
                  onChange={(e) => handleColorChange('card', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.card}
                  onChange={(e) => handleColorChange('card', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Main Text Color</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.text} 
                  onChange={(e) => handleColorChange('text', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.text}
                  onChange={(e) => handleColorChange('text', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Sidebar Color</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={theme.sidebar} 
                  onChange={(e) => handleColorChange('sidebar', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input 
                  type="text" 
                  value={theme.sidebar}
                  onChange={(e) => handleColorChange('sidebar', e.target.value)}
                  className="flex-1 uppercase font-mono"
                />
              </div>
            </div>

          </div>

          <div className="pt-6 border-t flex justify-end">
            <Button variant="outline" onClick={resetTheme} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Default Theme
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
