"use client"
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VoiceContextType {
    isVoiceActive: boolean;
    setVoiceActive: (active: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
    const [isVoiceActive, setVoiceActive] = useState(false);

    return (
        <VoiceContext.Provider value={{ isVoiceActive, setVoiceActive }}>
            {children}
        </VoiceContext.Provider>
    );
}

export function useVoice() {
    const context = useContext(VoiceContext);
    if (context === undefined) {
        throw new Error('useVoice must be used within a VoiceProvider');
    }
    return context;
}
