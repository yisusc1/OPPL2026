"use server";

import { revalidateTag } from "next/cache";

export interface ExchangeRate {
    moneda: string;
    fuente: string;
    nombre: string;
    valor: number;
    fechaActualizacion: string;
}

export async function scrapeBCVRate(): Promise<ExchangeRate | null> {
    // Disable TLS verification specifically for the BCV endpoint due to certificate issues
    const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
        const res = await fetch("https://www.bcv.org.ve/", {
            next: { revalidate: 3600, tags: ['bcv-rate'] }, // Cache for 1 hour
            headers: {
                // BCV sometimes blocks requests without a standard User-Agent
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            console.error("Failed to fetch BCV website, status:", res.status);
            return null;
        }

        const html = await res.text();

        // 1. Extract USD Value
        // The HTML structure typically looks like: <div id="dolar">...<strong> 36,12340000 </strong>...</div>
        // Let's use a regex to find the block for USD.
        // We look for 'USD' or 'dolar' context and grab the strong tag inside it.
        const usdRegex = /id="dolar"[\s\S]*?<strong>([\s\S]*?)<\/strong>/;
        const match = html.match(usdRegex);

        if (!match || !match[1]) {
            console.error("Could not find USD rate in BCV HTML string.");
            return null;
        }

        const rawValue = match[1].trim().replace(',', '.'); // Convert "36,123" to "36.123"
        const valor = parseFloat(rawValue);

        // 2. Extract Date
        // The HTML typically has: <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2024-02-12T00:00:00-04:00">...</span>
        // Or simply "Fecha Valor: Jueves, 12 Febrero 2024" nearby.
        const dateRegex = /Fecha Valor[\s\S]*?<span[\s\S]*?content="(.*?)"[\s\S]*?>/;
        const dateMatch = html.match(dateRegex);

        let fechaActualizacion = new Date().toISOString(); // Default to now if not found
        if (dateMatch && dateMatch[1]) {
            fechaActualizacion = new Date(dateMatch[1]).toISOString();
        }

        return {
            moneda: "USD",
            fuente: "BCV",
            nombre: "Dólar",
            valor,
            fechaActualizacion
        };

    } catch (error) {
        console.error("Scraping BCV error:", error);
        return null;
    } finally {
        // Restore original TLS setting
        if (originalRejectUnauthorized !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
        } else {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
    }
}
