'use client';

import React, { useState, useEffect } from 'react';

/**
 * Wrapper to prevent Next.js hydration mismatches caused by browser extensions
 * like Dark Reader that modify the DOM (e.g., injecting styles into SVGs)
 * before React has a chance to hydrate.
 */
export default function ClientOnly({ children, fallback = null }: { children: React.ReactNode, fallback?: React.ReactNode }) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
