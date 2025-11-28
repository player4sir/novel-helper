import { AlipaySdk } from 'alipay-sdk';
import WxPay from 'wechatpay-node-v3';
import { readFileSync } from 'fs';
import path from 'path';

// Environment variables should be set:
// ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY
// WECHAT_APPID, WECHAT_MCHID, WECHAT_PRIVATE_KEY_PATH, WECHAT_CERT_PATH, WECHAT_API_V3_KEY

export class AlipayService {
    private sdk: AlipaySdk | null = null;

    constructor() {
        if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY) {
            this.sdk = new AlipaySdk({
                appId: process.env.ALIPAY_APP_ID,
                privateKey: process.env.ALIPAY_PRIVATE_KEY,
                alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
            });
        }
    }

    async createNativePay(orderId: string, amount: number, description: string): Promise<string> {
        if (!this.sdk) {
            console.warn("Alipay SDK not configured, returning mock QR code");
            // Return a dummy QR code for testing
            return "https://qr.alipay.com/bax03989l8j655d4g7";
        }

        try {
            const result = await this.sdk.exec('alipay.trade.precreate', {
                bizContent: {
                    out_trade_no: orderId,
                    total_amount: (amount / 100).toFixed(2),
                    subject: description,
                },
            });
            return (result as any).qr_code as string;
        } catch (error) {
            console.error("Alipay create error:", error);
            throw new Error("Failed to create Alipay order");
        }
    }

    verifySignature(params: any): boolean {
        if (!this.sdk) return true; // Mock verification if SDK not init
        return this.sdk.checkNotifySign(params);
    }
}

export class WeChatPayService {
    private pay: WxPay | null = null;

    constructor() {
        if (process.env.WECHAT_APPID && process.env.WECHAT_MCHID) {
            try {
                // Handle potential file paths for keys
                const privateKey = process.env.WECHAT_PRIVATE_KEY_PATH
                    ? readFileSync(process.env.WECHAT_PRIVATE_KEY_PATH)
                    : Buffer.from(process.env.WECHAT_PRIVATE_KEY_CONTENT || '');

                const publicKey = process.env.WECHAT_CERT_PATH
                    ? readFileSync(process.env.WECHAT_CERT_PATH)
                    : Buffer.from(process.env.WECHAT_CERT_CONTENT || '');

                if (privateKey.length > 0 && publicKey.length > 0) {
                    this.pay = new WxPay({
                        appid: process.env.WECHAT_APPID,
                        mchid: process.env.WECHAT_MCHID,
                        publicKey: publicKey,
                        privateKey: privateKey,
                    });
                }
            } catch (e) {
                console.error("Failed to init WeChat Pay", e);
            }
        }
    }

    async createNativePay(orderId: string, amount: number, description: string): Promise<string> {
        if (!this.pay) {
            console.warn("WeChat Pay SDK not configured, returning mock QR code");
            return "weixin://wxpay/bizpayurl?pr=mock";
        }

        try {
            const result = await this.pay.transactions_native({
                description,
                out_trade_no: orderId,
                amount: {
                    total: amount,
                    currency: 'CNY',
                },
                notify_url: process.env.WECHAT_NOTIFY_URL || 'https://example.com/notify',
            });
            return (result as any).code_url;
        } catch (error) {
            console.error("WeChat Pay create error:", error);
            throw new Error("Failed to create WeChat Pay order");
        }
    }

    // Note: WeChat Pay V3 signature verification is complex and handled by the library usually,
    // or requires specific header parsing.
}

export const alipayService = new AlipayService();
export const wechatPayService = new WeChatPayService();
