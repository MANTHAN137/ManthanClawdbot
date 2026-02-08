// Shared state between WhatsApp client and Web Server
export let currentQR: string | null = null;
export let isConnected: boolean = false;

export function setQR(qr: string | null) {
    currentQR = qr;
}

export function setConnected(status: boolean) {
    isConnected = status;
}
