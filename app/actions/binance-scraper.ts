"use server";

export interface BinanceRate {
    price: number;
    asset: string;
    fiat: string;
    merchantName: string;
    tradeType: string;
}

export async function scrapeBinanceRate(): Promise<BinanceRate | null> {
    try {
        const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
                page: 1,
                rows: 1, // Only need the top 1 rate
                payTypes: [],
                asset: "USDT",
                tradeType: "BUY", // "BUY" means user is buying USDT with VES
                fiat: "VES"
            }),
            next: { revalidate: 300, tags: ['binance-rate'] } // Cache for 5 minutes
        });

        if (!res.ok) {
            console.error("Failed to fetch Binance P2P, status:", res.status);
            return null;
        }

        const data = await res.json();

        if (data && data.data && data.data.length > 0) {
            const topAd = data.data[0];
            return {
                price: parseFloat(topAd.adv.price),
                asset: topAd.adv.asset,
                fiat: topAd.adv.fiatUnit,
                merchantName: topAd.advertiser.nickName,
                tradeType: topAd.adv.tradeType
            };
        }

        return null;
    } catch (error) {
        console.error("Scraping Binance P2P error:", error);
        return null;
    }
}
