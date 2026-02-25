'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Bell, Database, Users, Shield, Save } from 'lucide-react';

function SettingsContent() {
  const [settings, setSettings] = useState({
    alarmThreshold: 75,
    refreshRate: 2,
    enableNotifications: true,
    enableAutoBackup: true,
    backupInterval: 24,
    adminEmail: 'admin@scada.local',
    systemName: 'Industrial SCADA System',
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const settingsGroups = [
    {
      title: 'System Configuration',
      icon: Database,
      settings: [
        { key: 'systemName', label: 'System Name', type: 'text' },
        { key: 'refreshRate', label: 'Data Refresh Rate (seconds)', type: 'number', min: 1, max: 60 },
        { key: 'alarmThreshold', label: 'Alarm Threshold (%)', type: 'number', min: 0, max: 100 },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      settings: [
        { key: 'enableNotifications', label: 'Enable Notifications', type: 'checkbox' },
        { key: 'adminEmail', label: 'Admin Email', type: 'email' },
      ],
    },
    {
      title: 'Backup',
      icon: Database,
      settings: [
        { key: 'enableAutoBackup', label: 'Enable Auto Backup', type: 'checkbox' },
        { key: 'backupInterval', label: 'Backup Interval (hours)', type: 'number', min: 1, max: 168 },
      ],
    },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold text-foreground">System Settings</h2>
          <p className="text-muted-foreground mt-1">Configure SCADA system parameters</p>
        </div>

        {saved && (
          <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm font-medium">
            ✓ Settings saved successfully
          </div>
        )}

        <div className="space-y-6">
          {settingsGroups.map((group, groupIndex) => {
            const Icon = group.icon;
            return (
              <div key={groupIndex} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Icon className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-bold text-foreground">{group.title}</h3>
                </div>

                <div className="space-y-4">
                  {group.settings.map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between">
                      <label className="text-sm text-muted-foreground font-medium">
                        {setting.label}
                      </label>

                      {setting.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={(settings as any)[setting.key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [setting.key]: e.target.checked,
                            })
                          }
                          className="w-5 h-5 rounded bg-input border border-border cursor-pointer"
                        />
                      ) : setting.type === 'email' ? (
                        <input
                          type="email"
                          value={(settings as any)[setting.key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [setting.key]: e.target.value,
                            })
                          }
                          className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent w-64"
                        />
                      ) : setting.type === 'number' ? (
                        <input
                          type="number"
                          value={(settings as any)[setting.key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [setting.key]: Number(e.target.value),
                            })
                          }
                          min={setting.min}
                          max={setting.max}
                          className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent w-32"
                        />
                      ) : (
                        <input
                          type="text"
                          value={(settings as any)[setting.key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [setting.key]: e.target.value,
                            })
                          }
                          className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent w-64"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Security Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-foreground">Security</h3>
            </div>

            <div className="space-y-3">
              <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-left">
                Change Password
              </button>
              <button className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors font-medium text-left">
                Manage API Keys
              </button>
              <button className="w-full px-4 py-2 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors font-medium text-left">
                View Audit Log
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>
    </MainLayout>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
