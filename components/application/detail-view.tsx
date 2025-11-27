"use client";

import { updateStatus, addNote } from "@/app/actions/applications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function ApplicationDetail({
  application,
  mappings,
  tenantId,
}: {
  application: any;
  mappings: any[];
  tenantId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const handleStatus = async (status: string) => {
    setLoading(true);
    await updateStatus(application.id, status, tenantId);
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setLoading(true);
    await addNote(application.id, note, tenantId);
    setNote("");
    setLoading(false);
  };

  // Hotkeys
  useHotkeys("1", () => handleStatus("accepted"), [tenantId, application.id]);
  useHotkeys("2", () => handleStatus("rejected"), [tenantId, application.id]);
  useHotkeys("3", () => handleStatus("waitlisted"), [tenantId, application.id]);
  useHotkeys("4", () => handleStatus("reviewing"), [tenantId, application.id]);
  useHotkeys("n", (e) => {
      e.preventDefault();
      noteInputRef.current?.focus();
  });
  useHotkeys("esc", () => router.push("/applications"));

  return (
    <div className="container mx-auto py-6 grid grid-cols-3 gap-6 h-[calc(100vh-4rem)]">
      {/* Left: Main Content */}
      <div className="col-span-2 space-y-6 overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Application Review</h1>
            <Badge className="text-lg px-4 py-1">{application.status}</Badge>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Applicant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {mappings.filter(m => m.isVisibleInDetail).map(field => {
                     const val = (application.customFields as any)?.[field.airtableFieldName];
                     return (
                         <div key={field.id} className="grid grid-cols-3 gap-4 border-b pb-4 last:border-0">
                             <div className="font-medium text-muted-foreground">{field.displayName}</div>
                             <div className="col-span-2 whitespace-pre-wrap">
                                 {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val || "-")}
                             </div>
                         </div>
                     )
                })}
            </CardContent>
        </Card>
      </div>

      {/* Right: Sidebar */}
      <div className="col-span-1 space-y-6 flex flex-col h-full">
        {/* Actions */}
        <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleStatus("accepted")} disabled={loading} className="bg-green-600 hover:bg-green-700">Accept (1)</Button>
                    <Button onClick={() => handleStatus("rejected")} disabled={loading} variant="destructive">Reject (2)</Button>
                    <Button onClick={() => handleStatus("waitlisted")} disabled={loading} variant="secondary">Waitlist (3)</Button>
                    <Button onClick={() => handleStatus("reviewing")} disabled={loading} variant="outline">Reviewing (4)</Button>
                </div>
                <div className="text-xs text-muted-foreground text-center pt-2">
                    Use keys 1-4 to set status, 'n' for note, 'esc' to back
                </div>
            </CardContent>
        </Card>

        {/* Priority */}
        <Card>
            <CardHeader><CardTitle>Priority Score</CardTitle></CardHeader>
            <CardContent>
                <div className="text-4xl font-bold text-center text-primary">
                    {application.priorityScore}
                </div>
            </CardContent>
        </Card>

        {/* Notes */}
        <Card className="flex-1 flex flex-col">
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px]">
                    {application.notes.map((n: any) => (
                        <div key={n.id} className="bg-muted p-3 rounded-md text-sm">
                            <p>{n.body}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                                {new Date(n.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    {application.notes.length === 0 && (
                        <div className="text-center text-muted-foreground italic">No notes yet</div>
                    )}
                </div>
                <div className="space-y-2 mt-auto">
                    <Textarea 
                        ref={noteInputRef}
                        placeholder="Add a note... (Press 'n')" 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <Button onClick={handleAddNote} disabled={loading || !note.trim()} className="w-full">Add Note</Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

