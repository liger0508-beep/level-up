"use client";

import { useState, useEffect } from "react";

export interface FilterState {
    activeFilter?: string;
    searchQuery?: string;
    selectAll?: boolean;
    selectedPlayers?: string[];
    startDate?: string;
    endDate?: string;
    activePreset?: string;
    [key: string]: any;
}

export function useFilterState(storageKey: string) {
    const [isRestored, setIsRestored] = useState(false);
    const [initialState, setInitialState] = useState<FilterState | null>(null);

    // On mount, load from sessionStorage
    useEffect(() => {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
            try {
                setInitialState(JSON.parse(stored));
            } catch (e) {
                console.warn(`Failed to parse filter state for ${storageKey}`, e);
            }
        }
        setIsRestored(true);
    }, [storageKey]);

    // Save function to be called in a useEffect in the component
    const saveState = (state: FilterState) => {
        if (isRestored) {
            sessionStorage.setItem(storageKey, JSON.stringify(state));
        }
    };

    return { isRestored, initialState, saveState };
}
