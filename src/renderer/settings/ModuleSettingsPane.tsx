import React, { useEffect, useState, useCallback } from 'react';
import { debounce } from 'lodash';

interface ModuleSettingsPaneProps {
  moduleId: string;
  settingsSchema?: any; // JSONSchema type
}

interface FieldProps {
  name: string;
  value: any;
  schema: any;
  onChange: (name: string, value: any) => void;
}

const Field: React.FC<FieldProps> = ({ name, value, schema, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newValue = schema.type === 'number' 
      ? parseFloat(e.target.value) 
      : e.target.type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : e.target.value;
    onChange(name, newValue);
  };

  // Render different input types based on schema
  if (schema.enum) {
    return (
      <div className="mb-4">
        <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
          {schema.title || name}
        </label>
        <select
          id={name}
          value={value || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {schema.enum.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {schema.description && (
          <p className="mt-1 text-sm text-gray-400">{schema.description}</p>
        )}
      </div>
    );
  }

  if (schema.type === 'boolean') {
    return (
      <div className="mb-4">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={value || false}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-300">
            {schema.title || name}
          </span>
        </label>
        {schema.description && (
          <p className="mt-1 text-sm text-gray-400 ml-7">{schema.description}</p>
        )}
      </div>
    );
  }

  if (schema.type === 'number') {
    return (
      <div className="mb-4">
        <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
          {schema.title || name}
        </label>
        <input
          id={name}
          type="number"
          value={value || ''}
          onChange={handleChange}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.step || 1}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {schema.description && (
          <p className="mt-1 text-sm text-gray-400">{schema.description}</p>
        )}
      </div>
    );
  }

  // Default to text input
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {schema.title || name}
      </label>
      <input
        id={name}
        type="text"
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {schema.description && (
        <p className="mt-1 text-sm text-gray-400">{schema.description}</p>
      )}
    </div>
  );
};

export const ModuleSettingsPane: React.FC<ModuleSettingsPaneProps> = ({ 
  moduleId, 
  settingsSchema 
}) => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const result = await window.ghost.getModuleSettings(moduleId);
        if (result.error) {
          throw new Error(result.error);
        }
        setSettings(result);
        console.debug('[ModuleSettingsPane] loaded', moduleId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [moduleId]);

  // Debounced save function
  const saveSettings = useCallback(
    debounce(async (updatedSettings: Record<string, any>) => {
      try {
        const result = await window.ghost.patchModuleSettings(moduleId, updatedSettings);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save settings');
        }
      } catch (err) {
        setError((err as Error).message);
      }
    }, 500),
    [moduleId]
  );

  const handleFieldChange = (name: string, value: any) => {
    const newSettings = { ...settings, [name]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="p-4 text-gray-400">
        Loading settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!settingsSchema || !settingsSchema.properties) {
    return (
      <div className="p-4 text-gray-400">
        No settings available for this module.
      </div>
    );
  }

  return (
    <div className="p-4">
      {Object.entries(settingsSchema.properties).map(([name, fieldSchema]) => (
        <Field
          key={name}
          name={name}
          value={settings[name]}
          schema={fieldSchema}
          onChange={handleFieldChange}
        />
      ))}
    </div>
  );
};