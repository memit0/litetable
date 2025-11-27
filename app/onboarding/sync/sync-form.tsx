"use client";

import { enableSync } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncForm({ tenantId }: { tenantId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        setLoading(true);
        try {
            await enableSync(tenantId);
            router.push("/applications");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button size="lg" className="w-full" onClick={handleStart} disabled={loading}>
            {loading ? "Starting..." : "Start Syncing & Go to Dashboard"}
        </Button>
    );
}

