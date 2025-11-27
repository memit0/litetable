"use client";

import { updateFieldMapping } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MappingsForm({ mappings }: { mappings: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async (id: string, current: boolean) => {
    await updateFieldMapping(id, { isVisibleInList: !current });
  };

  const handleNameChange = async (id: string, name: string) => {
    await updateFieldMapping(id, { displayName: name });
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Airtable Field</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Show in List</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.id}>
                <TableCell>{mapping.airtableFieldName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {mapping.airtableFieldType}
                </TableCell>
                <TableCell>
                  <Input
                    defaultValue={mapping.displayName}
                    onBlur={(e) => handleNameChange(mapping.id, e.target.value)}
                    className="max-w-[200px]"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={mapping.isVisibleInList}
                    onCheckedChange={() =>
                      handleToggle(mapping.id, mapping.isVisibleInList)
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => router.push("/onboarding/scoring")}>
          Next: Priority Scoring
        </Button>
      </div>
    </div>
  );
}

