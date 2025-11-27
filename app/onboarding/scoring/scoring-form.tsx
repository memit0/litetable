"use client";

import { updatePriorityConfig } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ScoringFormula = Record<string, number>;

export function ScoringForm({
  mappings,
  initialConfig,
  tenantId,
}: {
  mappings: any[];
  initialConfig: any;
  tenantId: string;
}) {
  const router = useRouter();
  const [formula, setFormula] = useState<ScoringFormula>(
    (initialConfig as ScoringFormula) || {}
  );

  const handleAdd = () => {
    // Find first available field
    const usedFields = Object.keys(formula);
    const available = mappings.find(
      (m) => !usedFields.includes(m.airtableFieldName)
    );
    if (available) {
      setFormula({ ...formula, [available.airtableFieldName]: 1 });
    }
  };

  const handleRemove = (field: string) => {
    const newFormula = { ...formula };
    delete newFormula[field];
    setFormula(newFormula);
  };

  const handleFieldChange = (oldField: string, newField: string) => {
    const weight = formula[oldField];
    const newFormula = { ...formula };
    delete newFormula[oldField];
    newFormula[newField] = weight;
    setFormula(newFormula);
  };

  const handleWeightChange = (field: string, weight: string) => {
    setFormula({ ...formula, [field]: parseFloat(weight) || 0 });
  };

  const handleSave = async () => {
    await updatePriorityConfig(tenantId, formula);
    router.push("/onboarding/sync");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        {Object.entries(formula).map(([field, weight], index) => (
          <div key={index} className="flex items-end gap-4 p-4 border rounded-md">
            <div className="flex-1 space-y-2">
              <Label>Airtable Field</Label>
              <Select
                value={field}
                onValueChange={(val) => handleFieldChange(field, val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {mappings.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.airtableFieldName}
                      disabled={
                        Object.keys(formula).includes(m.airtableFieldName) &&
                        m.airtableFieldName !== field
                      }
                    >
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-2">
              <Label>Weight</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => handleWeightChange(field, e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleRemove(field)}
            >
              X
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Button variant="outline" onClick={handleAdd}>
          Add Field Rule
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Next: Sync Settings</Button>
      </div>
    </div>
  );
}

