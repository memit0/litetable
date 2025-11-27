"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectAirtable } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConnectPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      apiKey: formData.get("apiKey") as string,
      baseId: formData.get("baseId") as string,
      tableId: formData.get("tableId") as string,
    };

    try {
      await connectAirtable(data);
      router.push("/onboarding/mappings");
    } catch (error) {
      alert("Failed to connect: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Card className="mx-auto max-w-md w-full">
        <CardHeader>
          <CardTitle>Connect Airtable</CardTitle>
          <CardDescription>
            Enter your Airtable details to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" name="name" required placeholder="Acme Corp" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apiKey">Personal Access Token (PAT)</Label>
              <Input 
                id="apiKey" 
                name="apiKey" 
                type="password" 
                required 
                placeholder="pat..." 
              />
              <p className="text-xs text-muted-foreground">
                Create a token with "data.records:read", "data.records:write", and "schema.bases:read" scopes at{" "}
                <a 
                  href="https://airtable.com/create/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  airtable.com/create/tokens
                </a>
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseId">Base ID</Label>
              <Input id="baseId" name="baseId" required placeholder="app..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tableId">Table ID</Label>
              <Input id="tableId" name="tableId" required placeholder="tbl..." />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connecting..." : "Connect & Discover Schema"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

